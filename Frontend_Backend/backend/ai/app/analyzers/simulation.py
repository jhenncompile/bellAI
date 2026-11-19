"""HU-019 / HU-020 / HU-021: simuladores de estilo sobre la foto de la usuaria.

Transformaciones 2D guiadas por landmarks y segmentación (sin IA generativa, que requeriría GPU):
- cabello: cambio de color y mechas tipo balayage sobre la máscara de cabello,
- maquillaje: labial, rubor y sombra de ojos sobre las regiones de FaceMesh,
- uñas: esmalte sobre las puntas de los dedos (Hand Landmarker),
- gafas: monturas dibujadas a escala y alineadas con los ojos,
- prenda (HU-022): una prenda del armario ajustada sobre el cuerpo con el Pose Landmarker.
Conservan la textura original (se modifica el color en LAB y se mezcla con bordes suaves).
"""
from __future__ import annotations

import base64
import math
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np

from app.analyzers import mp_runtime as mpr

VERSION = "simulation-2d-1.0.0"

LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
LEFT_LID = [33, 246, 161, 160, 159, 158, 157, 173, 133]
LEFT_BROW = [107, 66, 105, 63, 70]
RIGHT_LID = [362, 398, 384, 385, 386, 387, 388, 466, 263]
RIGHT_BROW = [300, 293, 334, 296, 336]
FINGER_TIPS = [(4, 3), (8, 7), (12, 11), (16, 15), (20, 19)]

FRAME_STYLES = ("redondas", "rectangulares", "cat-eye", "aviador", "oversize")


def hex_to_bgr(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        raise ValueError("El color debe tener formato #RRGGBB.")
    return int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)


def encode_jpeg(img: np.ndarray, quality: int = 88) -> str:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("No se pudo codificar la imagen resultante.")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _recolor(img: np.ndarray, mask: np.ndarray, color_bgr: Tuple[int, int, int], intensity: float, keep_light: float = 0.75) -> np.ndarray:
    """Cambia el color de la región manteniendo la luminosidad (textura) original."""
    alpha = (mask.astype(np.float32) / 255.0 * float(np.clip(intensity, 0, 1)))[..., None]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    target = cv2.cvtColor(np.uint8([[color_bgr]]), cv2.COLOR_BGR2LAB)[0, 0].astype(np.float32)
    sel = mask > 20
    mean_l = float(lab[..., 0][sel].mean()) if sel.any() else 128.0
    new = lab.copy()
    # Desplaza la luminosidad hacia la del color objetivo conservando el detalle
    new[..., 0] = lab[..., 0] * keep_light + (lab[..., 0] - mean_l + target[0]) * (1 - keep_light)
    new[..., 1] = target[1]
    new[..., 2] = target[2]
    new = np.clip(new, 0, 255).astype(np.uint8)
    recolored = cv2.cvtColor(new, cv2.COLOR_LAB2BGR).astype(np.float32)
    out = img.astype(np.float32) * (1 - alpha) + recolored * alpha
    return np.clip(out, 0, 255).astype(np.uint8)


def _feather(mask: np.ndarray, size: int) -> np.ndarray:
    k = max(3, size | 1)
    return cv2.GaussianBlur(mask, (k, k), 0)


def _face_landmarks(img: np.ndarray) -> np.ndarray:
    res = mpr.detect_faces(img)
    if not res.face_landmarks:
        raise ValueError("No se detectó un rostro para aplicar la simulación.")
    h, w = img.shape[:2]
    return mpr.landmarks_px(res.face_landmarks[0], w, h)


def simulate_hair(img: np.ndarray, color: str, intensity: float = 0.8, style: str = "completo") -> Tuple[np.ndarray, Dict[str, Any]]:
    from app.analyzers.color import hair_mask  # evita import circular
    hm, hmeta = hair_mask(img)
    mask = (hm * 255).astype(np.uint8)
    coverage = float((mask > 0).mean())
    if coverage < 0.004:
        raise ValueError("No se distingue el cabello en la foto. Usa una foto con el cabello suelto y visible.")
    mask = _feather(cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), int(min(img.shape[:2]) * 0.02))
    if style in ("mechas", "balayage"):
        ys = np.where(mask > 30)[0]
        top, bottom = (int(ys.min()), int(ys.max())) if len(ys) else (0, img.shape[0])
        grad = np.clip((np.arange(img.shape[0]) - top) / max(1, bottom - top), 0, 1) ** 1.3
        mask = (mask.astype(np.float32) * grad[:, None]).astype(np.uint8)
        if style == "mechas":
            stripes = ((np.sin(np.arange(img.shape[1]) / max(3.0, img.shape[1] / 60.0)) > 0.3) * 255).astype(np.uint8)
            mask = cv2.bitwise_and(mask, np.broadcast_to(stripes, mask.shape).copy())
            mask = _feather(mask, 9)
    out = _recolor(img, mask, hex_to_bgr(color), intensity, keep_light=0.7)
    return out, {"hairCoverage": round(coverage, 3), "style": style, "segmentationModel": hmeta["model"]}


def simulate_makeup(img: np.ndarray, lips: Optional[str] = None, blush: Optional[str] = None, eyeshadow: Optional[str] = None,
                    intensity: float = 0.6) -> Tuple[np.ndarray, Dict[str, Any]]:
    if not any([lips, blush, eyeshadow]):
        raise ValueError("Elige al menos un producto: labial, rubor o sombra.")
    lm = _face_landmarks(img)
    h, w = img.shape[:2]
    face_w = float(lm[:, 0].max() - lm[:, 0].min())
    out = img.copy()
    applied = []
    if lips:
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, [lm[LIPS_OUTER].astype(np.int32)], 255)
        cv2.fillPoly(m, [lm[LIPS_INNER].astype(np.int32)], 0)
        out = _recolor(out, _feather(m, int(face_w * 0.02)), hex_to_bgr(lips), min(1.0, intensity + 0.2), keep_light=0.8)
        applied.append("labial")
    if blush:
        m = np.zeros((h, w), np.uint8)
        r = int(face_w * 0.09)
        for idx in (50, 280):
            cx, cy = lm[idx]
            cv2.circle(m, (int(cx), int(cy - r * 0.2)), r, 255, -1)
        out = _recolor(out, _feather(m, int(r * 1.6)), hex_to_bgr(blush), intensity * 0.45, keep_light=0.9)
        applied.append("rubor")
    if eyeshadow:
        m = np.zeros((h, w), np.uint8)
        for lid, brow in ((LEFT_LID, LEFT_BROW), (RIGHT_LID, RIGHT_BROW)):
            lid_pts = lm[lid]
            brow_pts = lm[brow]
            # La sombra ocupa ~55% del espacio entre párpado y ceja
            upper = lid_pts[::-1] + (np.interp(lid_pts[::-1, 0], np.sort(brow_pts[:, 0]), brow_pts[np.argsort(brow_pts[:, 0]), 1]) - lid_pts[::-1, 1])[:, None] * np.array([0, 0.55])
            poly = np.vstack([lid_pts, upper]).astype(np.int32)
            cv2.fillPoly(m, [poly], 255)
        out = _recolor(out, _feather(m, int(face_w * 0.03)), hex_to_bgr(eyeshadow), intensity * 0.6, keep_light=0.85)
        applied.append("sombra")
    return out, {"applied": applied}


def simulate_nails(img: np.ndarray, color: str, intensity: float = 0.9) -> Tuple[np.ndarray, Dict[str, Any]]:
    res = mpr.detect_hands(img)
    if not res.hand_landmarks:
        raise ValueError("No se detectaron manos. Toma la foto con la mano abierta y las uñas visibles.")
    h, w = img.shape[:2]
    m = np.zeros((h, w), np.uint8)
    nails = 0
    for hand in res.hand_landmarks:
        pts = mpr.landmarks_px(hand, w, h)
        for tip, dip in FINGER_TIPS:
            t, d = pts[tip], pts[dip]
            seg_len = float(np.linalg.norm(t - d))
            if seg_len < 4:
                continue
            center = t + (d - t) * 0.38
            angle = math.degrees(math.atan2(d[1] - t[1], d[0] - t[0]))
            axes = (int(seg_len * 0.42), int(seg_len * (0.36 if tip != 4 else 0.42)))
            cv2.ellipse(m, (int(center[0]), int(center[1])), axes, angle, 0, 360, 255, -1)
            nails += 1
    out = _recolor(img, _feather(m, 5), hex_to_bgr(color), intensity, keep_light=0.55)
    return out, {"nails": nails, "hands": len(res.hand_landmarks), "note": "Posición aproximada de las uñas a partir de las puntas de los dedos."}


def simulate_glasses(img: np.ndarray, style: str = "rectangulares", color: str = "#1A1A1A", tint: float = 0.0) -> Tuple[np.ndarray, Dict[str, Any]]:
    if style not in FRAME_STYLES:
        raise ValueError(f"Estilo de montura no válido. Opciones: {', '.join(FRAME_STYLES)}.")
    lm = _face_landmarks(img)
    left = (lm[33] + lm[133]) / 2
    right = (lm[362] + lm[263]) / 2
    eye_dist = float(np.linalg.norm(right - left))
    angle = math.degrees(math.atan2(right[1] - left[1], right[0] - left[0]))
    scale = {"oversize": 1.25, "aviador": 1.1}.get(style, 1.0)
    lens_w, lens_h = eye_dist * 0.47 * scale, eye_dist * (0.36 if style == "rectangulares" else 0.4) * scale
    thick = max(2, int(eye_dist * 0.045))
    col = hex_to_bgr(color)
    h, w = img.shape[:2]
    # Se dibuja en un lienzo con el rostro "recto" y luego se rota con la inclinación de la cabeza
    canvas = np.zeros((h, w, 3), np.uint8)
    lens_mask = np.zeros((h, w), np.uint8)
    frame_mask = np.zeros((h, w), np.uint8)
    mid = (left + right) / 2
    centers = [mid + np.array([-eye_dist / 2, lens_h * 0.08]), mid + np.array([eye_dist / 2, lens_h * 0.08])]

    def lens_poly(c: np.ndarray, side: int) -> np.ndarray:
        cx, cy = c
        if style in ("redondas",):
            return cv2.ellipse2Poly((int(cx), int(cy)), (int(lens_w / 2), int(lens_w / 2 * 0.92)), 0, 0, 360, 8)
        if style == "aviador":
            pts = [(-0.5, -0.45), (0.5, -0.5), (0.48, 0.05), (0.3, 0.5), (-0.1, 0.55), (-0.45, 0.25)]
        elif style == "cat-eye":
            pts = [(-0.5, -0.2), (-0.1, -0.45), (0.5, -0.6), (0.45, 0.1), (0.2, 0.45), (-0.35, 0.4)]
        else:  # rectangulares / oversize
            pts = [(-0.5, -0.45), (0.5, -0.45), (0.5, 0.4), (-0.5, 0.4)]
        arr = np.array([(cx + x * lens_w * (1 if side > 0 else -1), cy + y * lens_h) for x, y in pts], np.int32)
        return arr

    for i, c in enumerate(centers):
        poly = lens_poly(c, 1 if i == 1 else -1)
        cv2.fillPoly(lens_mask, [poly], 255)
        cv2.polylines(frame_mask, [poly], True, 255, thick, cv2.LINE_AA)
    bridge_y = int(mid[1] - lens_h * 0.15)
    cv2.line(frame_mask, (int(centers[0][0] + lens_w / 2), bridge_y), (int(centers[1][0] - lens_w / 2), bridge_y), 255, thick, cv2.LINE_AA)
    for i, c in enumerate(centers):
        edge_x = c[0] + (lens_w / 2 if i == 1 else -lens_w / 2)
        temple_x = lm[454][0] if i == 1 else lm[234][0]
        cv2.line(frame_mask, (int(edge_x), int(c[1] - lens_h * 0.3)), (int(temple_x), int(c[1] - lens_h * 0.2)), 255, max(2, thick - 1), cv2.LINE_AA)
    rot = cv2.getRotationMatrix2D((float(mid[0]), float(mid[1])), -angle, 1.0)
    lens_mask = cv2.warpAffine(lens_mask, rot, (w, h))
    frame_mask = cv2.warpAffine(frame_mask, rot, (w, h))
    out = img.astype(np.float32)
    if tint > 0:
        la = (lens_mask.astype(np.float32) / 255 * min(0.8, tint))[..., None]
        out = out * (1 - la) + np.array(col, np.float32) * 0.6 * la
    fa = (cv2.GaussianBlur(frame_mask, (3, 3), 0).astype(np.float32) / 255)[..., None]
    canvas[:] = col
    out = out * (1 - fa) + canvas.astype(np.float32) * fa
    return np.clip(out, 0, 255).astype(np.uint8), {"style": style, "eyeDistancePx": round(eye_dist, 1), "rollDeg": round(angle, 1)}


GARMENT_REGIONS = ("superior", "inferior", "completo")


def _pose_points(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    res = mpr.detect_pose(img)
    if not res.pose_landmarks:
        raise ValueError("No se detectó tu cuerpo. Usa una foto de frente donde se vean tus hombros y caderas.")
    lms = res.pose_landmarks[0]
    h, w = img.shape[:2]
    pts = mpr.landmarks_px(lms, w, h)
    vis = np.array([getattr(lm, "visibility", 1.0) or 0.0 for lm in lms], dtype=np.float32)
    return pts, vis


def _garment_cutout(garment: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Recorta la prenda de su fondo (GrabCut) y devuelve (imagen, alfa 0-1) ajustadas a su contorno."""
    from app.analyzers.garment import garment_mask  # import diferido: evita cargar CLIP al importar

    mask = garment_mask(garment)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    ys, xs = np.where(mask > 0)
    if len(xs) < 50:
        raise ValueError("No pudimos separar la prenda del fondo. Usa una foto de la prenda sobre un fondo liso.")
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = garment[y0:y1, x0:x1]
    alpha = cv2.GaussianBlur(mask[y0:y1, x0:x1], (0, 0), 2).astype(np.float32) / 255.0
    return crop, alpha


def simulate_garment(img: np.ndarray, garment: Optional[np.ndarray], region: str = "superior", opacity: float = 0.97) -> Tuple[np.ndarray, Dict[str, Any]]:
    """HU-022: probador 2D. Coloca la prenda entre los puntos del cuerpo según la región:
    superior (hombros → caderas), inferior (caderas → tobillos) o completo (hombros → rodillas/tobillos).
    Conserva las sombras de la foto para que la prenda siga los pliegues del cuerpo."""
    if garment is None:
        raise ValueError("Falta la foto de la prenda para el probador.")
    if region not in GARMENT_REGIONS:
        raise ValueError("Región no válida. Usa superior, inferior o completo.")
    pts, vis = _pose_points(img)
    h, w = img.shape[:2]

    def need(ids, what):
        if min(vis[i] for i in ids) < 0.5:
            raise ValueError(f"No se ven bien {what}. Toma la foto de frente y con más distancia.")

    need([11, 12], "tus hombros") if region != "inferior" else None
    need([23, 24], "tus caderas")
    sh = sorted([pts[11], pts[12]], key=lambda p: p[0])
    hp = sorted([pts[23], pts[24]], key=lambda p: p[0])
    sh_w = float(np.linalg.norm(sh[1] - sh[0]))
    hp_w = max(float(np.linalg.norm(hp[1] - hp[0])), sh_w * 0.6)
    torso = float(np.linalg.norm((hp[0] + hp[1]) / 2 - (sh[0] + sh[1]) / 2))

    def bottom_points():
        legs = [25, 26] if region == "completo" and min(vis[27], vis[28]) < 0.5 else [27, 28]
        if region == "inferior" or region == "completo":
            if min(vis[i] for i in legs) < 0.5:
                legs = [25, 26]
                need(legs, "tus rodillas")
        lp = sorted([pts[legs[0]], pts[legs[1]]], key=lambda p: p[0])
        return lp

    if region == "superior":
        top_y_off = torso * 0.08
        tl = sh[0] + np.array([-sh_w * 0.22, -top_y_off]); tr = sh[1] + np.array([sh_w * 0.22, -top_y_off])
        bl = hp[0] + np.array([-hp_w * 0.30, torso * 0.12]); br = hp[1] + np.array([hp_w * 0.30, torso * 0.12])
    elif region == "inferior":
        lp = bottom_points()
        tl = hp[0] + np.array([-hp_w * 0.35, -torso * 0.06]); tr = hp[1] + np.array([hp_w * 0.35, -torso * 0.06])
        bl = lp[0] + np.array([-hp_w * 0.30, torso * 0.06]); br = lp[1] + np.array([hp_w * 0.30, torso * 0.06])
    else:
        lp = bottom_points()
        tl = sh[0] + np.array([-sh_w * 0.20, -torso * 0.08]); tr = sh[1] + np.array([sh_w * 0.20, -torso * 0.08])
        bl = lp[0] + np.array([-hp_w * 0.45, 0]); br = lp[1] + np.array([hp_w * 0.45, 0])

    crop, alpha = _garment_cutout(garment)
    gh, gw = crop.shape[:2]
    src = np.float32([[0, 0], [gw, 0], [gw, gh], [0, gh]])
    dst = np.float32([tl, tr, br, bl])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(crop, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    a = cv2.warpPerspective(alpha, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)[..., None] * float(np.clip(opacity, 0, 1))
    if float(a.mean()) < 1e-4:
        raise ValueError("La prenda quedó fuera de la foto. Aléjate un poco para que se vea tu cuerpo.")

    # Sombras de la foto original (pliegues, luz lateral) aplicadas a la prenda, sin su color
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), max(6.0, sh_w * 0.12))  # solo pliegues grandes, no el estampado previo
    inside = a[..., 0] > 0.5
    ref = float(blur[inside].mean()) if inside.any() else float(blur.mean())
    shade = np.clip(blur / max(ref, 1.0), 0.6, 1.25)[..., None]
    shaded = np.clip(warped.astype(np.float32) * (0.7 + 0.3 * shade), 0, 255)
    # Antebrazos por delante del cuerpo (p. ej. mano en la cadera): se mantienen sobre la prenda
    arms = np.zeros((h, w), np.uint8)
    for elbow, wrist in ((13, 15), (14, 16)):
        if min(vis[elbow], vis[wrist]) >= 0.6:
            cv2.line(arms, tuple(int(v) for v in pts[elbow]), tuple(int(v) for v in pts[wrist]), 255, max(4, int(sh_w * 0.16)))
            cv2.circle(arms, tuple(int(v) for v in pts[wrist]), max(4, int(sh_w * 0.12)), 255, -1)
    a = a * (1 - cv2.GaussianBlur(arms, (0, 0), 3).astype(np.float32)[..., None] / 255.0)
    out = img.astype(np.float32) * (1 - a) + shaded * a
    covered = float((a[..., 0] > 0.5).mean())
    return np.clip(out, 0, 255).astype(np.uint8), {
        "region": region,
        "shoulderWidthPx": round(sh_w, 1),
        "coverage": round(covered, 3),
        "note": "Vista aproximada en 2D: la prenda se ajusta a tu postura, pero no simula la caída real de la tela.",
    }


def simulate(kind: str, img: np.ndarray, options: Dict[str, Any], garment: Optional[np.ndarray] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
    intensity = float(options.get("intensity", 0.8))
    if kind == "color_cabello":
        return simulate_hair(img, options.get("color", "#6B4423"), intensity, options.get("style", "completo"))
    if kind == "maquillaje":
        return simulate_makeup(img, options.get("lips"), options.get("blush"), options.get("eyeshadow"), float(options.get("intensity", 0.6)))
    if kind == "unas":
        return simulate_nails(img, options.get("color", "#C2185B"), intensity)
    if kind == "gafas":
        return simulate_glasses(img, options.get("style", "rectangulares"), options.get("color", "#1A1A1A"), float(options.get("tint", 0)))
    if kind == "prenda":
        return simulate_garment(img, garment, options.get("region", "superior"), float(options.get("opacity", 0.97)))
    raise ValueError("Tipo de simulación no válido. Usa color_cabello, maquillaje, unas, gafas o prenda.")
