"""
Rutas /api/v1/vision/*: visión por computadora con modelos reales.

| Función            | Modelo que se ejecuta                                                        |
|--------------------|------------------------------------------------------------------------------|
| predict            | ResNet-34 (ImageNet, resnet34_pretrained.pt): las 5 clases más probables     |
| analyze_garment    | ResNet-34 (ImageNet) + CLIP MobileCLIP2-S0 (sin entrenamiento previo) + color |
| analyze_face       | MediaPipe Face Landmarker + segmentador multiclase (colorimetría medida)     |
| segment_hair       | BiSeNet ResNet-18 face parsing (o MediaPipe si no está descargado)            |
| analyze_outfit     | SegFormer-B2 (ATR): prendas que lleva puestas y su color                     |
| analyze_body       | MediaPipe Pose Landmarker (33 puntos clave) + segmentación de la persona     |
| virtual_tryon      | MediaPipe Pose: la prenda se ajusta a hombros/caderas (vista 2D aproximada)  |
| virtual_makeup     | MediaPipe Face Landmarker: color sobre labios, pómulos y párpados            |

Qué se quitó y por qué:
- `unet_pretrained.pt` es el U-Net de mateuszbuda/brain-segmentation-pytorch (tumores cerebrales en
  resonancias), no un modelo de cabello. El cabello sale ahora de la clase "cabello" de MediaPipe.
- `colorimetry_v1.pt`, `wardrobe_v1.pt` y `style_recommender_v1.pt` tienen la capa de salida con los
  mismos valores que una inicialización aleatoria (no se entrenaron), así que no se cargan.
- Las confianzas fijas (0,90–0,95) y los "puntos clave" calculados como fracciones del recuadro.
Las confianzas que se devuelven son probabilidades del modelo o `None` cuando no hay modelo.
"""
from __future__ import annotations

import base64
from typing import Any, Dict, Optional

import cv2
import numpy as np
import torch

from app.analyzers import body as body_analyzer
from app.analyzers import color as color_analyzer
from app.analyzers import face as face_analyzer
from app.analyzers import garment as garment_analyzer
from app.analyzers import mp_runtime as mpr
from app.analyzers import onnx_models
from app.analyzers import quality, simulation
from app.analyzers.imaging import decode_image, jsonable
from app.models import garment_fusion
from app.models.resnet_garment import RESNET_GARMENT
from app.models.weights import imagenet_categories, load_resnet34

VERSION = "vision-2.0.0"

# Reglas para decidir el tipo de prenda (ver analyze_garment)
RESNET_GARMENT_MIN = 0.5    # probabilidad total de clases de ropa para fiarse de ResNet-34
RESNET_CLASS_MIN = 0.35     # probabilidad de la subcategoría ganadora
RESNET_WEAK_MIN = 0.2       # por debajo, ResNet-34 no reconoce una prenda

# Probador: categoría del armario -> zona del cuerpo
TRYON_REGION = {"superior": "superior", "abrigo": "superior", "inferior": "inferior", "vestidos": "completo", "completo": "completo"}

# Maquillaje según subtono (labial, rubor, sombra)
MAKEUP_BY_UNDERTONE = {
    "calido": {"lips": "#C2410C", "blush": "#EA580C", "eyeshadow": "#78350F"},
    "frio": {"lips": "#BE123C", "blush": "#E11D48", "eyeshadow": "#1E293B"},
    "neutro": {"lips": "#B4534A", "blush": "#E07A5F", "eyeshadow": "#5B4636"},
}


def _require(report: quality.QualityReport) -> None:
    """Convierte una foto no apta en un error con el motivo en lenguaje natural."""
    if not report.valid:
        problems = report.as_dict().get("problems", [])
        reason = "; ".join(p.get("message", "") for p in problems if p.get("message")) or "la foto no es apta"
        raise ValueError(f"No se pudo analizar la foto: {reason}.")


def _jpeg_b64(img: np.ndarray, quality_pct: int = 90) -> str:
    ok, enc = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality_pct])
    if not ok:
        raise ValueError("No fue posible codificar la imagen.")
    return base64.b64encode(enc.tobytes()).decode("ascii")


class VisionModelManager:
    """Punto de entrada de /vision. Los modelos se cargan la primera vez que se usan."""

    def __init__(self, device: str = "cpu"):
        self.device = torch.device(device)

    # ------------------------------------------------------------------ ResNet-34 genérico
    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """Clasificación ImageNet con ResNet-34: devuelve las 5 clases más probables."""
        img = decode_image(image_bytes)
        model = load_resnet34()
        x = RESNET_GARMENT.to_tensor(img)
        with torch.no_grad():
            probs = torch.softmax(model(x), dim=1)[0]
        top = torch.topk(probs, 5)
        cats = imagenet_categories()
        scores = {cats[i]: round(float(v), 4) for v, i in zip(top.values.tolist(), top.indices.tolist())}
        best = next(iter(scores))
        return {
            "model_type": "resnet34_imagenet",
            "model_version": VERSION,
            "predicted_class": best,
            "confidence": scores[best],
            "all_scores": scores,
        }

    # ------------------------------------------------------------------ Armario digital
    def analyze_garment(self, image_bytes: bytes, filename_hint: str = "") -> Dict[str, Any]:
        """
        Tipo, color y foto tipo catálogo de una prenda.

        Decisión del tipo (de más a menos fiable):
        1. ResNet-34 reconoce claramente una prenda de ImageNet (jeans, falda, abrigo, zapatilla…).
        2. Si no, CLIP (cubre blusa, camisa, tacones, pantalón de vestir… que ImageNet no tiene).
        3. Si no hay CLIP, ResNet-34 con probabilidad baja, avisando con `lowConfidence`.
        4. Si ningún modelo reconoce nada, la silueta o el nombre del archivo, con confianza `None`.
        """
        img = decode_image(image_bytes)
        mask, mask_source, worn_class = garment_analyzer.garment_segmentation(img)
        x, y, w, h = cv2.boundingRect((mask > 0).astype(np.uint8))
        smart = garment_analyzer.analyze(img, mask=mask)  # color + CLIP, con la misma máscara
        resnet = RESNET_GARMENT.classify(img, mask)
        clip_ok = smart.get("method") == "clip_zero_shot"
        resnet_ok = resnet["garmentProbability"] >= RESNET_WEAK_MIN

        low_confidence = False
        if clip_ok or resnet_ok:
            # Producto de expertos: ResNet-34 + CLIP + la clase de SegFormer si la prenda está puesta
            probs = garment_fusion.fuse(
                list(garment_analyzer.SUBCATEGORIES),
                resnet=resnet["distribution"] if resnet_ok else None,
                resnet_garment_prob=resnet["garmentProbability"],
                clip=smart.get("clipDistribution") if clip_ok else None,
                segformer_class=worn_class,
            )
            ranked = sorted(probs.items(), key=lambda kv: -kv[1])
            sub, conf = ranked[0]
            if clip_ok and resnet_ok:
                method = "resnet34_imagenet+clip"
            else:
                method = "clip_zero_shot" if clip_ok else "resnet34_imagenet"
            # Solo ResNet con una prenda dudosa, o una decisión repartida: se pide confirmar
            low_confidence = conf < 0.45 or (not clip_ok and resnet["garmentProbability"] < RESNET_GARMENT_MIN)
            alternatives = [{"subcategory": s, "probability": round(p, 3)} for s, p in ranked[1:4] if p >= 0.02]
        else:
            sub = self._hint_subcategory(filename_hint) or self._silhouette_subcategory(mask)
            conf, method, low_confidence, alternatives = None, "heuristica", True, []

        category = garment_analyzer.SUBCATEGORIES.get(sub, ("superior", ""))[0]

        return jsonable({
            "model_type": "wardrobe_garment_classifier",
            "model_version": VERSION,
            "category": category,
            "subcategory": sub,
            "color": smart["color"],
            "color_hex": smart["colorHex"],
            "colors": smart.get("colors", []),
            # Probabilidad del nombre del color (medida CIEDE2000 + CLIP) y alternativas cercanas
            "color_confidence": smart.get("colorConfidence"),
            "color_alternatives": smart.get("colorAlternatives", []),
            "color_method": smart.get("colorMethod"),
            "white_balance_gains": smart.get("whiteBalanceGains"),
            "approximate_size": self._approximate_size(w, h),
            "season": self._infer_season(sub),
            "confidence": None if conf is None else round(conf, 3),
            "lowConfidence": low_confidence,
            "method": method,
            "alternatives": alternatives[:3],
            "pattern": smart.get("pattern", "liso"),
            "style": smart.get("style"),
            "styles": smart.get("styles", []),
            "occasion": smart.get("occasion"),
            "resnet34": {
                "subcategory": resnet["subcategory"],
                "probability": resnet["probability"],
                "garmentProbability": resnet["garmentProbability"],
                "imagenetTop5": resnet["imagenetTop5"],
            },
            "clip": {"subcategory": smart["subcategory"], "probability": smart["confidence"]} if clip_ok else None,
            "segmentation": {"model": mask_source, "wornGarment": onnx_models.CLOTHES_LABELS.get(worn_class) if worn_class else None},
            "feature_vector": [round(float(v), 5) for v in RESNET_GARMENT.embed(img, mask)],
            "enhanced_image_base64": self._studio_image(img),
            "enhancement_applied": ["studio_lighting_clahe", "catalog_centering_4x5"],
        })

    @staticmethod
    def _hint_subcategory(filename_hint: str) -> Optional[str]:
        """Subcategoría escrita en el nombre del archivo (p. ej. 'falda_azul.jpg')."""
        hint = (filename_hint or "").lower()
        for sub in garment_analyzer.SUBCATEGORIES:
            if sub.rstrip("s") in hint:
                return sub
        return None

    @staticmethod
    def _silhouette_subcategory(mask: np.ndarray) -> str:
        """Último recurso: proporción de la silueta (sin modelo, por eso la confianza es None)."""
        x, y, w, h = cv2.boundingRect((mask > 0).astype(np.uint8))
        if w < 10 or h < 10:
            return "otros"
        aspect = h / max(w, 1)
        if aspect < 0.7:
            return "zapatillas"
        if aspect > 1.4:
            return "pantalones"
        return "camisetas"

    @staticmethod
    def _approximate_size(w: int, h: int) -> str:
        ratio = float(w) / float(max(h, 1))
        if ratio < 0.62:
            return "S (Aprox.)"
        if ratio < 0.85:
            return "M (Aprox.)"
        if ratio < 1.05:
            return "L (Aprox.)"
        return "M (Aprox.)"

    @staticmethod
    def _infer_season(subcategory: str) -> str:
        if subcategory in ("abrigos", "chaquetas", "sueteres", "botas"):
            return "invierno"
        if subcategory in ("shorts", "sandalias", "tops"):
            return "verano"
        if subcategory in ("vestidos", "blusas", "faldas"):
            return "primavera"
        return "todo_el_ano"

    @staticmethod
    def _studio_image(img_bgr: np.ndarray) -> str:
        """Luz uniforme (CLAHE sobre L*) y prenda centrada en un lienzo 800x1000."""
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        l_chan = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8)).apply(l_chan)
        enhanced = cv2.cvtColor(cv2.merge((l_chan, a_chan, b_chan)), cv2.COLOR_LAB2BGR)
        canvas = np.full((1000, 800, 3), (248, 250, 252), dtype=np.uint8)
        h, w = enhanced.shape[:2]
        scale = min(800 * 0.82 / max(w, 1), 1000 * 0.82 / max(h, 1))
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        resized = cv2.resize(enhanced, (nw, nh), interpolation=cv2.INTER_AREA)
        y0, x0 = (1000 - nh) // 2, (800 - nw) // 2
        canvas[y0:y0 + nh, x0:x0 + nw] = resized
        return _jpeg_b64(canvas)

    # ------------------------------------------------------------------ Rostro y colorimetría
    def analyze_face(self, image_bytes: bytes) -> Dict[str, Any]:
        """Forma del rostro y colorimetría medidas sobre los 478 puntos de MediaPipe."""
        img = decode_image(image_bytes)
        report = quality.validate(img, "rostro")
        _require(report)
        return jsonable({
            "model_type": "mediapipe_face_landmarker",
            "model_version": VERSION,
            "quality": report.as_dict(),
            "face": face_analyzer.analyze(img, report.face_landmarks),
            "colorimetry": color_analyzer.analyze(img, report.face_landmarks),
        })

    # ------------------------------------------------------------------ Cabello
    def segment_hair(self, image_bytes: bytes) -> Dict[str, Any]:
        """Segmentación de cabello con la clase 'cabello' del segmentador multiclase de MediaPipe."""
        img = decode_image(image_bytes)
        hair, hmeta = color_analyzer.hair_mask(img)
        hair = cv2.morphologyEx(hair, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        coverage = float(hair.mean())
        if coverage < 0.005:
            raise ValueError("No se distingue el cabello en la foto. Usa una foto con el cabello visible y buena luz.")

        pixels = img[hair > 0]
        lab = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
        l_val = float(np.median(lab[:, 0])) * 100.0 / 255.0
        b, g, r = (int(v) for v in np.median(pixels, axis=0))
        if l_val < 22:
            tone = "Negro / Azabache"
        elif l_val < 38:
            tone = "Castaño oscuro"
        elif l_val < 52:
            tone = "Castaño medio"
        elif l_val < 65:
            tone = "Rubio oscuro"
        else:
            tone = "Rubio claro"

        overlay = img.copy()
        overlay[hair > 0] = (60, 180, 75)
        blended = cv2.addWeighted(img, 0.65, overlay, 0.35, 0)
        return {
            "success": True,
            "model_type": hmeta["model"],
            "model_architecture": (
                "BiSeNet (ResNet-18) face parsing, CelebAMask-HQ: separa cabello, sombrero y gafas"
                if hmeta["model"].startswith("bisenet") else "MediaPipe selfie_multiclass_256x256 (clase cabello)"
            ),
            "model_version": VERSION,
            "coveragePercentage": round(coverage * 100.0, 2),
            "hairTone": tone,
            "luminanceL": round(l_val, 1),
            "hairRgb": {"r": r, "g": g, "b": b},
            "overlayBase64": _jpeg_b64(blended),
        }

    # ------------------------------------------------------------------ Ropa puesta
    # Clase de SegFormer (ATR) -> (subcategoría del armario, categoría)
    OUTFIT_CLASSES = {
        4: ("prenda_superior", "superior"), 5: ("faldas", "inferior"), 6: ("pantalones", "inferior"),
        7: ("vestidos", "superior"), 8: ("cinturon", "accesorio"), 16: ("bolso", "accesorio"),
        17: ("bufanda", "accesorio"), 1: ("sombrero", "accesorio"),
    }
    SHOES = (9, 10)

    def analyze_outfit(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Prendas que lleva puestas la persona de la foto (SegFormer-B2 entrenado en ATR) y el color
        medido sobre los píxeles de cada una. Sirve para registrar o evaluar un look completo.
        """
        if not onnx_models.is_available("clothes_parsing"):
            raise mpr.ModelUnavailableError(
                "Falta el modelo 'segformer_b2_clothes.onnx' u onnxruntime. Ejecuta scripts/download_models.py --with-onnx."
            )
        img = decode_image(image_bytes)
        parse = onnx_models.parse_clothes(img)
        person = parse > 0
        if person.mean() < 0.03:
            raise ValueError("No se ve a una persona en la foto. Usa una foto de cuerpo entero con buena luz.")
        items = []
        groups = [(k, v[0], v[1], parse == k) for k, v in self.OUTFIT_CLASSES.items()]
        groups.append((9, "calzado", "calzado", np.isin(parse, self.SHOES)))
        for cls, sub, cat, m in groups:
            share = float(m.sum()) / float(person.sum())
            if share < 0.02:
                continue
            colors = garment_analyzer.color_analysis(img, (m * 255).astype(np.uint8))
            items.append({
                "subcategory": sub,
                "category": cat,
                "label": onnx_models.CLOTHES_LABELS.get(cls, sub),
                "areaShare": round(share, 3),
                "color": colors["main"].get("name"),
                "colorHex": colors["main"].get("hex"),
                "colors": colors["colors"][:3],
            })
        if not items:
            raise ValueError("No se distinguen prendas en la foto. Prueba con una foto de cuerpo entero y fondo despejado.")
        items.sort(key=lambda it: -it["areaShare"])
        return jsonable({
            "model_type": "segformer_b2_clothes",
            "model_architecture": "SegFormer-B2 entrenado en ATR (18 clases de ropa y cuerpo)",
            "model_version": VERSION,
            "garments": items,
            "note": "Detección por píxeles: confirma cada prenda antes de guardarla en tu armario.",
        })

    # ------------------------------------------------------------------ Cuerpo
    def analyze_body(self, image_bytes: bytes) -> Dict[str, Any]:
        """Proporciones y tipo de silueta a partir de los 33 puntos de MediaPipe Pose."""
        img = decode_image(image_bytes)
        report = quality.validate(img, "cuerpo")
        _require(report)
        return jsonable({
            "model_type": "mediapipe_pose_landmarker",
            "model_version": VERSION,
            "quality": report.as_dict(),
            "body": body_analyzer.analyze(img, report.pose_landmarks),
        })

    # ------------------------------------------------------------------ Simulaciones
    def virtual_tryon(self, person_bytes: bytes, garment_bytes: bytes, category: str = "superior") -> Dict[str, Any]:
        """Coloca la prenda sobre la foto siguiendo hombros y caderas (MediaPipe Pose)."""
        person = decode_image(person_bytes)
        garment = decode_image(garment_bytes)
        region = TRYON_REGION.get((category or "superior").lower(), "superior")
        out, meta = simulation.simulate_garment(person, garment, region)
        return jsonable({
            "success": True,
            "model_type": "mediapipe_pose_tryon_2d",
            "model_architecture": "MediaPipe Pose + recorte de la prenda (vista 2D aproximada)",
            "model_version": VERSION,
            "region": region,
            "rendered_image_base64": _jpeg_b64(out),
            "meta": meta,
        })

    def virtual_makeup(self, face_bytes: bytes, style: str = "natural_calido", undertone: str = "Calido") -> Dict[str, Any]:
        """Labial, rubor y sombra según el subtono, aplicados con los puntos del rostro (MediaPipe)."""
        img = decode_image(face_bytes)
        key = (undertone or "").lower().replace("á", "a").replace("í", "i")
        palette = MAKEUP_BY_UNDERTONE.get(key, MAKEUP_BY_UNDERTONE["neutro"])
        out, meta = simulation.simulate_makeup(img, palette["lips"], palette["blush"], palette["eyeshadow"], 0.6)
        return jsonable({
            "success": True,
            "model_type": "mediapipe_face_makeup",
            "model_architecture": "MediaPipe Face Landmarker (labios, pómulos y párpados)",
            "model_version": VERSION,
            "style": style,
            "undertone": undertone,
            "applied_palette": palette,
            "rendered_image_base64": _jpeg_b64(out),
            "meta": meta,
        })

