"""HU-004 / HU-006: colorimetría personal y lectura básica del cabello.

1. Balance de blancos 'gray world' atenuado para reducir dominantes de la luz.
2. Segmentación (selfie_multiclass) para separar piel del rostro y cabello.
3. Muestras de piel en mejillas y frente (landmarks), iris (puntos 468-477) y cabello.
4. CIELAB robusto -> tono, subtono (ángulo de matiz), profundidad, contraste e intensidad.
5. Estación por característica dominante (temperatura, valor o croma) entre 12 estaciones.
"""
from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np

from app.analyzers import mp_runtime as mpr
from app.analyzers import onnx_models
from app.analyzers.imaging import gray_world, jsonable, lab_to_hex, robust_lab
from app.analyzers.palettes import palette_for

VERSION = "colorimetry-1.1.0"

SKIN_POINTS = [50, 280, 205, 425, 151, 101, 330]
IRIS_L, IRIS_R = 468, 473


def _patch_mask(shape, points, radius: int) -> np.ndarray:
    m = np.zeros(shape[:2], dtype=np.uint8)
    for x, y in points:
        cv2.circle(m, (int(x), int(y)), radius, 255, -1)
    return m


def _iris_pixels(img: np.ndarray, lm: np.ndarray) -> np.ndarray:
    if len(lm) < 478:
        return np.zeros((0, 3), dtype=np.uint8)
    out = []
    for c in (IRIS_L, IRIS_R):
        center = lm[c]
        radius = float(np.mean([np.linalg.norm(lm[c + i] - center) for i in range(1, 5)]))
        if radius < 2:
            continue
        outer = np.zeros(img.shape[:2], np.uint8)
        cv2.circle(outer, (int(center[0]), int(center[1])), int(radius * 0.9), 255, -1)
        cv2.circle(outer, (int(center[0]), int(center[1])), int(radius * 0.4), 0, -1)
        out.append(img[outer > 0])
    return np.concatenate(out) if out else np.zeros((0, 3), dtype=np.uint8)


def _skin_tone_label(L: float) -> str:
    if L >= 72:
        return "Muy clara"
    if L >= 62:
        return "Clara"
    if L >= 52:
        return "Media"
    if L >= 40:
        return "Morena"
    return "Profunda"


def hair_mask(img_bgr: np.ndarray, lm_px: Optional[np.ndarray] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Máscara de cabello (H,W) uint8 0/1 y metadatos. Con BiSeNet face parsing (si está descargado)
    el cabello se separa del sombrero y las gafas; el cabello que cae fuera del recorte del rostro y
    las fotos sin rostro detectable se completan con el segmentador de MediaPipe.
    """
    seg = mpr.segment(img_bgr)
    mp_hair = (seg == mpr.SEG_HAIR).astype(np.uint8)
    if not onnx_models.is_available("face_parsing"):
        return mp_hair, {"model": "mediapipe_selfie_multiclass", "hatCoverage": None, "glasses": None}
    if lm_px is None:
        res = mpr.detect_faces(img_bgr)
        if not res.face_landmarks:
            return mp_hair, {"model": "mediapipe_selfie_multiclass", "hatCoverage": None, "glasses": None}
        lm_px = mpr.landmarks_px(res.face_landmarks[0], img_bgr.shape[1], img_bgr.shape[0])
    parse = onnx_models.parse_face(img_bgr, lm_px)
    mask = (parse == onnx_models.FP_HAIR).astype(np.uint8)
    l, t, r, b = onnx_models.face_box(lm_px, img_bgr.shape)
    outside = np.ones(mask.shape, bool)
    outside[t:b, l:r] = False
    mask[outside & (mp_hair > 0)] = 1
    hat = parse == onnx_models.FP_HAT
    mask[hat] = 0   # lo que el modelo ve como sombrero nunca cuenta como cabello
    face_area = max(1, (r - l) * (b - t))
    return mask, {
        "model": "bisenet_resnet18_face_parsing",
        "hatCoverage": round(float(hat.sum()) / face_area, 3),
        "glasses": bool((parse == onnx_models.FP_GLASSES).sum() > face_area * 0.005),
        "parse": parse,
    }


# Textura del cabello con CLIP zero-shot (MobileCLIP2-S0, el mismo modelo de las prendas).
# Evaluación con 14 fotos reales de Wikimedia Commons (scripts de evaluación fuera del repo):
# cabeza completa 10/14, solo el cabello 6/11, combinadas 0,7/0,3 -> 11/14. Los fallos son entre
# tipos vecinos (rizado <-> ondulado). Muestra pequeña: se informa la probabilidad y, por debajo de
# HAIR_TEXTURE_MIN, la textura se marca como dudosa.
HAIR_TEXTURES = {
    "Liso": ("a photo of a person with straight hair", "sleek straight hair", "long straight smooth hair"),
    "Ondulado": ("a photo of a person with wavy hair", "loose beach waves hair", "softly wavy hair"),
    "Rizado": ("a photo of a person with curly hair", "ringlet curls hair", "bouncy curly hair"),
    "Afro / Crespo": ("a photo of a person with afro-textured coily hair", "kinky coily afro hair",
                      "tightly coiled natural hair, braids or locs"),
}
HAIR_TEXTURE_HEAD_WEIGHT = 0.7
HAIR_TEXTURE_MIN = 0.5
HAIR_TEXTURE_CARE = {
    "Liso": ["Champú ligero: el liso se engrasa antes en la raíz.", "Las capas y el flequillo le dan movimiento."],
    "Ondulado": ["Seca con difusor o al aire para definir la onda.", "Evita cepillar en seco: abre la onda y da frizz."],
    "Rizado": ["Hidratación frecuente y crema para rizos.", "Desenreda solo en húmedo y con los dedos o peine de púas anchas."],
    "Afro / Crespo": ["Prioriza la hidratación (método LOC: líquido, aceite, crema).", "Peinados protectores y funda de satén para dormir."],
}


def hair_texture(img: np.ndarray, hair_mask: np.ndarray, lm: np.ndarray) -> Optional[Dict[str, Any]]:
    """Liso / ondulado / rizado / afro combinando la cabeza completa y el cabello recortado."""
    from app.analyzers.garment import CLIP  # import diferido: CLIP es opcional
    if not CLIP.available():
        return None
    h, w = img.shape[:2]
    x0, y0 = lm.min(0)
    x1, y1 = lm.max(0)
    fw, fh = x1 - x0, y1 - y0
    head = img[max(0, int(y0 - fh)):min(h, int(y1 + 1.5 * fh)), max(0, int(x0 - fw)):min(w, int(x1 + fw))]
    p = CLIP.zero_shot(head, HAIR_TEXTURES, "hair_texture")
    if p is None:
        return None
    labels = list(HAIR_TEXTURES)
    probs = np.array([p[k] for k in labels])
    ys, xs = np.where(hair_mask > 0)
    if len(xs) > 200:
        only = img.copy()
        only[hair_mask == 0] = 128
        q = CLIP.zero_shot(only[ys.min():ys.max() + 1, xs.min():xs.max() + 1], HAIR_TEXTURES, "hair_texture")
        if q:
            wh = HAIR_TEXTURE_HEAD_WEIGHT
            probs = np.exp(wh * np.log(probs + 1e-6) + (1 - wh) * np.log(np.array([q[k] for k in labels]) + 1e-6))
            probs /= probs.sum()
    order = np.argsort(-probs)
    best = labels[order[0]]
    return {
        "type": best,
        "probability": round(float(probs[order[0]]), 3),
        "uncertain": bool(probs[order[0]] < HAIR_TEXTURE_MIN),
        "alternatives": [{"type": labels[i], "probability": round(float(probs[i]), 3)} for i in order[1:3]],
        "care": HAIR_TEXTURE_CARE[best],
        "model": "mobileclip2_s0_zero_shot",
    }


def _hair_reading(img: np.ndarray, hair_mask: np.ndarray, lm: np.ndarray, skin_L: float) -> Dict[str, Any]:
    hair = (hair_mask > 0).astype(np.uint8)
    hair = cv2.erode(hair, np.ones((3, 3), np.uint8))
    pixels = img[hair > 0]
    if len(pixels) < 300:
        return {"detected": False, "note": "No se distingue el cabello en la foto (recogido o cubierto)."}
    L, a, b = robust_lab(pixels)
    chin_y, top_y = float(lm[152][1]), float(lm[10][1])
    face_h = max(1.0, chin_y - top_y)
    ys = np.where(hair > 0)[0]
    bottom = float(np.percentile(ys, 98))
    reach = (bottom - chin_y) / face_h
    length = "Corto" if reach < 0.15 else "Medio" if reach < 1.0 else "Largo"
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32) * 100 / 255
    hl = lab[hair > 0]
    shine = float((hl > L + 22).mean())
    contours, _ = cv2.findContours(hair, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    frizz = 0.0
    if contours:
        c = max(contours, key=cv2.contourArea)
        area, per = cv2.contourArea(c), cv2.arcLength(c, True)
        hull_per = cv2.arcLength(cv2.convexHull(c), True)
        frizz = float(np.clip((per / max(hull_per, 1.0) - 1.0) * 2.0, 0.0, 1.0)) if area > 0 else 0.0
    depth = "Negro" if L < 18 else "Castaño oscuro" if L < 30 else "Castaño" if L < 42 else "Castaño claro" if L < 55 else "Rubio"
    temp = "cálido" if math.degrees(math.atan2(b, a)) > 60 and b > 6 else "frío o neutro"
    return {
        "detected": True,
        "baseColor": {"hex": lab_to_hex(L, a, b), "name": f"{depth} {temp}", "lab": [round(L, 1), round(a, 1), round(b, 1)]},
        "length": length,
        "shine": round(shine, 3),
        "frizzIndex": round(frizz, 3),
        "condition": (
            "Brillo bajo y contorno irregular: podría indicar resequedad o porosidad alta." if shine < 0.04 and frizz > 0.35
            else "Brillo bajo: conviene hidratar." if shine < 0.04
            else "Buen brillo y contorno definido."
        ),
        "conditionNote": "Estimación visual a partir de una foto. No sustituye una evaluación profesional.",
        "contrastWithSkin": round(abs(skin_L - L), 1),
        "texture": hair_texture(img, hair_mask, lm),
    }


def _season(t: float, v: float, c: float) -> Tuple[str, str, float]:
    """Devuelve (estación, característica dominante, fuerza) según el sistema de 12 estaciones."""
    dims = {"temperatura": abs(t), "profundidad": abs(v), "intensidad": abs(c)}
    dominant = max(dims, key=dims.get)
    cool = t <= 0
    if dominant == "profundidad":
        season = ("Verano Claro (Light Summer)" if cool else "Primavera Clara (Light Spring)") if v > 0 else (
            "Invierno Fuerte (Deep Winter)" if cool else "Otono Fuerte (Deep Autumn)")
    elif dominant == "intensidad":
        season = ("Invierno Brillante (Clear Winter)" if cool else "Primavera Brillante (Clear Spring)") if c > 0 else (
            "Verano Suave (Soft Summer)" if cool else "Otono Suave (Soft Autumn)")
    else:
        if cool:
            season = "Invierno Frio (True Winter)" if (v < 0 or c > 0) else "Verano Frio (True Summer)"
        else:
            season = "Otono Calido (True Autumn)" if (v < 0 or c < 0) else "Primavera Calida (True Spring)"
    ordered = sorted(dims.values(), reverse=True)
    strength = float(ordered[0] - ordered[1] * 0.5)
    return season, dominant, strength


DOMINANT_TEXT = {
    "temperatura": lambda t, v, c: "subtono cálido" if t > 0 else "subtono frío",
    "profundidad": lambda t, v, c: "rasgos claros" if v > 0 else "rasgos profundos",
    "intensidad": lambda t, v, c: "colores nítidos y brillantes" if c > 0 else "colores suaves y empolvados",
}

CONTRAST_RULES = {
    "Alto": "Combina claros y oscuros (por ejemplo blanco con azul noche). Evita looks monocromáticos apagados.",
    "Medio": "Combina tonos con diferencia moderada; un acento de color cerca del rostro te favorece.",
    "Bajo": "Prefiere combinaciones tono sobre tono y transiciones suaves; evita el blanco con negro.",
}


def analyze(img_bgr: np.ndarray, lm_px: Optional[np.ndarray] = None) -> Dict[str, Any]:
    h, w = img_bgr.shape[:2]
    if lm_px is None:
        res = mpr.detect_faces(img_bgr)
        if not res.face_landmarks:
            raise ValueError("No se detectó un rostro en la imagen.")
        lm_px = mpr.landmarks_px(res.face_landmarks[0], w, h)
    balanced = gray_world(img_bgr, 0.5)
    face_w = float(lm_px[:, 0].max() - lm_px[:, 0].min())
    radius = max(3, int(face_w * 0.05))
    patches = _patch_mask(img_bgr.shape, [lm_px[i] for i in SKIN_POINTS], radius)
    # Segmentación: BiSeNet face parsing (ResNet-18, CelebAMask-HQ) separa piel de cejas, gafas,
    # sombrero y cabello píxel a píxel; si no está descargado se usa el segmentador de MediaPipe.
    hmask, hmeta = hair_mask(balanced, lm_px)
    segmentation_model = hmeta["model"]
    if "parse" in hmeta:
        skin_class = hmeta.pop("parse") == onnx_models.FP_SKIN
    else:
        skin_class = mpr.segment(balanced) == mpr.SEG_FACE_SKIN
    skin_mask = cv2.bitwise_and(patches, (skin_class * 255).astype(np.uint8))
    if int((skin_mask > 0).sum()) < 150:
        skin_mask = patches
    sL, sa, sb = robust_lab(balanced[skin_mask > 0])
    hue = math.degrees(math.atan2(sb, sa))
    chroma = math.hypot(sa, sb)
    hair = _hair_reading(balanced, hmask, lm_px, sL)
    if not hair.get("detected") and (hmeta.get("hatCoverage") or 0) > 0.08:
        hair["note"] = "El cabello está cubierto por un sombrero o gorra: quítatelo para analizar su color."
    hair_L = hair["baseColor"]["lab"][0] if hair.get("detected") else max(10.0, sL - 35)
    iris = _iris_pixels(balanced, lm_px)
    eye_lab = robust_lab(iris) if len(iris) >= 20 else (35.0, 5.0, 12.0)
    eye_chroma = math.hypot(eye_lab[1], eye_lab[2])

    t = float(np.clip((hue - 58.0) / 10.0, -1, 1))            # >0 cálido
    depth_L = 0.6 * sL + 0.4 * hair_L
    v = float(np.clip((depth_L - 48.0) / 16.0, -1, 1))         # >0 claro
    delta_L = abs(sL - hair_L)
    c = float(np.clip(0.6 * (delta_L - 32.0) / 18.0 + 0.4 * (eye_chroma - 14.0) / 12.0, -1, 1))  # >0 brillante

    undertone = "Calido" if t > 0.25 else "Frio" if t < -0.25 else "Neutro"
    contrast = "Alto" if delta_L >= 45 else "Medio" if delta_L >= 25 else "Bajo"
    season, dominant, strength = _season(t, v, c)
    pal = palette_for(season)
    confidence = round(float(np.clip(0.55 + strength * 0.4, 0.4, 0.95)), 3)

    return jsonable({
        "modelVersion": VERSION,
        "segmentationModel": segmentation_model,
        "accessories": {"glasses": hmeta.get("glasses"), "hat": None if hmeta.get("hatCoverage") is None else hmeta["hatCoverage"] > 0.08},
        "season": season,
        "dominantCharacteristic": dominant,
        "confidence": confidence,
        "skinTone": _skin_tone_label(sL),
        "skinHex": lab_to_hex(sL, sa, sb),
        "undertone": undertone,
        "contrastLevel": contrast,
        "metrics": {
            "lab": {"L": round(sL, 1), "a": round(sa, 1), "b": round(sb, 1)},
            "hueAngle": round(hue, 1),
            "chroma": round(chroma, 1),
            "deltaL": round(delta_L, 1),
            "eyeLab": [round(x, 1) for x in eye_lab],
            "scores": {"temperature": round(t, 2), "value": round(v, 2), "chroma": round(c, 2)},
        },
        "eyes": {"hex": lab_to_hex(*eye_lab)},
        "hair": hair,
        "colors": {
            "palette": pal["colors"],
            "recommended": [s for s in pal["colors"] if s["category"] == "base"],
            "neutrals": [s for s in pal["colors"] if s["category"] == "neutro"],
            "accents": [s for s in pal["colors"] if s["category"] == "acento"],
            "toxicColors": pal["avoid"],
            "recommendedMetals": pal["metals"],
            "lipsticks": pal["lipsticks"],
            "glassesFrames": pal["frames"],
            "hairShades": pal["hairShades"],
            "avoidHairShades": pal["avoidHairShades"],
        },
        "explanations": {
            "undertone": f"El matiz de tu piel mide {hue:.0f}° (por encima de 60° tiende a cálido y por debajo de 56° a frío).",
            "season": f"Tu rasgo dominante es la {dominant} ({DOMINANT_TEXT[dominant](t, v, c)}); por eso tu estación es {season}.",
            "contrastRule": CONTRAST_RULES[contrast],
        },
        "parameters": {
            "whiteBalance": "gray world (50%)",
            "skinSamples": "mejillas y frente intersectadas con la máscara de piel facial",
            "segmenter": "MediaPipe selfie_multiclass_256x256",
        },
    })
