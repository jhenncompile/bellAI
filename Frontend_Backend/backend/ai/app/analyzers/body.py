"""HU-003: análisis corporal y de proporciones con MediaPipe Pose Landmarker.

Mide hombros, cintura y cadera sobre la máscara de la persona (filas a la altura de las
articulaciones), la relación torso/piernas (verticalidad) y deriva un perfil de silueta con
sugerencias de líneas, cortes y largos. No emite juicios de valor ni ideales estéticos: el
objetivo es describir proporciones para armonizar prendas.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import cv2
import numpy as np

from app.analyzers import mp_runtime as mpr
from app.analyzers import onnx_models
from app.analyzers.imaging import jsonable

VERSION = "body-proportions-1.0.0"

L_SH, R_SH, L_HIP, R_HIP, L_ANK, R_ANK, NOSE = 11, 12, 23, 24, 27, 28, 0

SILHOUETTES: Dict[str, Dict[str, Any]] = {
    "Reloj de Arena (Hourglass)": {
        "description": "Hombros y caderas de anchura parecida con la cintura claramente más estrecha.",
        "lines": ["Prendas que acompañen la cintura", "Líneas curvas y fluidas"],
        "cuts": ["Vestidos cruzados (wrap)", "Pantalón de tiro alto", "Blazer entallado"],
        "necklines": ["En V", "Corazón", "Cruzado"],
        "lengths": ["Faldas a la rodilla o midi", "Chaquetas a la cadera"],
        "structures": ["Tejidos con caída", "Cinturones en la cintura natural"],
        "kibbe": "Romántica (inspiración): curvas suaves y equilibrio entre hombro y cadera.",
    },
    "Triangulo / Pera": {
        "description": "Caderas más anchas que los hombros.",
        "lines": ["Dar volumen o detalle en la parte superior", "Líneas limpias abajo"],
        "cuts": ["Falda en A", "Pantalón recto o de pierna ancha", "Hombros estructurados"],
        "necklines": ["Barco", "Cuadrado", "Hombros descubiertos"],
        "lengths": ["Blusas a la cintura o por dentro", "Chaquetas cortas sobre la cadera"],
        "structures": ["Tops con estampado o textura", "Partes inferiores lisas y oscuras"],
        "kibbe": "Clásica suave (inspiración): equilibra la parte superior con estructura.",
    },
    "Triangulo Invertido": {
        "description": "Hombros más anchos que las caderas.",
        "lines": ["Volumen o detalle en la parte inferior", "Líneas verticales arriba"],
        "cuts": ["Falda con vuelo", "Pantalón palazzo o cargo", "Escote en V"],
        "necklines": ["En V", "En U", "Halter"],
        "lengths": ["Tops que lleguen a la cadera", "Faldas midi con movimiento"],
        "structures": ["Tejidos suaves arriba", "Estampados y volumen abajo"],
        "kibbe": "Natural (inspiración): hombros marcados con líneas relajadas.",
    },
    "Rectangular / Atletica": {
        "description": "Hombros, cintura y caderas de anchura parecida.",
        "lines": ["Crear o marcar la cintura", "Capas y contrastes de textura"],
        "cuts": ["Peplum", "Cinturones", "Vestidos con fruncido o drapeado"],
        "necklines": ["Redondo", "Corazón", "Cuello alto"],
        "lengths": ["Chaquetas cortas o largas", "Faldas lápiz o con vuelo"],
        "structures": ["Prendas con estructura", "Volúmenes en mangas o caderas"],
        "kibbe": "Natural o dramática (inspiración): líneas rectas y verticales.",
    },
    "Oval / Manzana": {
        "description": "La zona media es igual o más ancha que hombros y caderas.",
        "lines": ["Líneas verticales que alarguen", "Prendas con caída desde el busto"],
        "cuts": ["Vestido imperio", "Blusas fluidas", "Pantalón recto de tiro medio"],
        "necklines": ["En V profundo", "Cuello abierto"],
        "lengths": ["Tops que pasen la cadera", "Chaquetas largas abiertas"],
        "structures": ["Tejidos con caída", "Detalles cerca del rostro y las piernas"],
        "kibbe": "Gamine suave (inspiración): líneas limpias y detalles en los extremos.",
    },
}


# Heurística sin calibrar con fotos reales de la app (ver docs/CasosDeUsos/HU-003).
# Ropa ajustada ~2,0-2,1; el caftán de la foto de prueba da 2,40 con el modelo de pose "full"
# (que separa un poco más las caderas que "lite"), así que el corte queda entre ambos casos.
LOOSE_HIP_RATIO = 2.3
_ARMS_AND_BAG = (14, 15, 16)   # brazo izquierdo, brazo derecho, bolso (clases ATR de SegFormer)


def _run_width(row: np.ndarray, center_x: int, keep: Optional[np.ndarray] = None) -> int:
    """
    Ancho del tramo continuo de la máscara que contiene center_x. Con `keep` (fila de la persona
    sin brazos) se descuentan los brazos de los extremos: el tramo se mide sobre la silueta completa
    para que un brazo no lo parta en dos.
    """
    if center_x < 0 or center_x >= len(row) or not row[center_x]:
        idx = np.where(row)[0]
        if len(idx) == 0:
            return 0
        center_x = int(idx[np.argmin(np.abs(idx - center_x))])
    left = center_x
    while left > 0 and row[left - 1]:
        left -= 1
    right = center_x
    while right < len(row) - 1 and row[right + 1]:
        right += 1
    full = right - left + 1
    if keep is None:
        return full
    # Solo se recortan los brazos que tocan los bordes del tramo (brazos caídos a los lados).
    # Una mano o un bolso delante del torso no reduce el ancho del cuerpo.
    lo, hi = left, right
    while lo < hi and not keep[lo]:
        lo += 1
    while hi > lo and not keep[hi]:
        hi -= 1
    inner = hi - lo + 1
    # Si casi todo el tramo es «brazo», SegFormer se equivocó: se usa la silueta
    return inner if inner >= 0.55 * full else full


def measure(lm_px: np.ndarray, person: np.ndarray, torso: Optional[np.ndarray] = None) -> Dict[str, float]:
    """
    Mide proporciones a partir de landmarks en píxeles (33,2) y máscara booleana de persona.
    `torso` es la persona sin brazos ni bolso (SegFormer): con los brazos pegados a los costados, la
    cintura medida sobre la silueta completa incluye los antebrazos y sale tan ancha como la cadera.
    """
    h = person.shape[0]
    sh_y = int((lm_px[L_SH][1] + lm_px[R_SH][1]) / 2)
    hip_y = int((lm_px[L_HIP][1] + lm_px[R_HIP][1]) / 2)
    ank_y = int((lm_px[L_ANK][1] + lm_px[R_ANK][1]) / 2)
    torso_h = max(1, hip_y - sh_y)
    cx = int((lm_px[L_HIP][0] + lm_px[R_HIP][0]) / 2)
    cx_sh = int((lm_px[L_SH][0] + lm_px[R_SH][0]) / 2)

    def width_at(y: int, center: int, without_arms: bool = False) -> int:
        yy = int(np.clip(y, 0, h - 1))
        return _run_width(person[yy], center, torso[yy] if without_arms and torso is not None else None)

    # Los hombros se miden con la silueta completa (el deltoides forma parte del ancho de hombros)
    shoulder = float(np.median([width_at(sh_y + d, cx_sh) for d in range(-2, 3)]))
    waist_rows = range(sh_y + int(0.45 * torso_h), hip_y - int(0.05 * torso_h))
    waist = float(min((width_at(y, cx, True) for y in waist_rows), default=0))
    hip_rows = range(hip_y - int(0.05 * torso_h), hip_y + int(0.30 * torso_h))
    hip = float(max((width_at(y, cx, True) for y in hip_rows), default=0))
    if min(shoulder, waist, hip) <= 0:
        raise ValueError("No se pudo medir la silueta. Usa un fondo despejado y ropa ajustada.")
    legs = max(1, ank_y - hip_y)
    return {
        "shoulderWidthPx": shoulder,
        "waistWidthPx": waist,
        "hipWidthPx": hip,
        "shoulderToHip": shoulder / hip,
        "waistToHip": waist / hip,
        "waistToShoulder": waist / shoulder,
        "legToBody": legs / float(legs + torso_h),
    }


def _torso_without_arms(img_bgr: np.ndarray, person: np.ndarray) -> Optional[np.ndarray]:
    """Persona sin brazos ni bolso según SegFormer-B2 (ATR). None si el modelo no está."""
    if not onnx_models.is_available("clothes_parsing"):
        return None
    try:
        parse = onnx_models.parse_clothes(img_bgr)
    except Exception:  # noqa: BLE001 - sin el modelo se mide la silueta completa
        return None
    if parse.shape != person.shape:
        parse = cv2.resize(parse, (person.shape[1], person.shape[0]), interpolation=cv2.INTER_NEAREST)
    removed = np.isin(parse, _ARMS_AND_BAG)
    # Se dilata un poco: el borde del brazo que SegFormer asigna a la ropa también sobra
    removed = cv2.dilate(removed.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    return person & ~removed


def classify(m: Dict[str, float]) -> Dict[str, Any]:
    s_h, w_h, w_s = m["shoulderToHip"], m["waistToHip"], m["waistToShoulder"]
    if w_h >= 0.9 and w_s >= 0.9:
        shape, margin = "Oval / Manzana", min(w_h, w_s) - 0.9
    elif s_h < 0.95:
        shape, margin = "Triangulo / Pera", 0.95 - s_h
    elif s_h > 1.05:
        shape, margin = "Triangulo Invertido", s_h - 1.05
    elif w_h <= 0.75:
        shape, margin = "Reloj de Arena (Hourglass)", 0.75 - w_h
    else:
        shape, margin = "Rectangular / Atletica", w_h - 0.75
    confidence = float(np.clip(0.6 + margin * 3.0, 0.5, 0.95))
    leg = m["legToBody"]
    vertical = "Piernas largas en proporción al torso" if leg > 0.62 else "Torso largo en proporción a las piernas" if leg < 0.55 else "Torso y piernas equilibrados"
    return {"bodyType": shape, "confidence": round(confidence, 3), "verticality": vertical}


def analyze(img_bgr: np.ndarray, pose_landmarks=None, person_mask: Optional[np.ndarray] = None) -> Dict[str, Any]:
    h, w = img_bgr.shape[:2]
    if pose_landmarks is None or person_mask is None:
        res = mpr.detect_pose(img_bgr)
        if not res.pose_landmarks:
            raise ValueError("No se detectó el cuerpo en la imagen.")
        pose_landmarks = res.pose_landmarks[0]
        if res.segmentation_masks:
            person_mask = res.segmentation_masks[0].numpy_view().squeeze() > 0.5
        else:
            person_mask = mpr.segment(img_bgr) != mpr.SEG_BACKGROUND
    lm = mpr.landmarks_px(pose_landmarks, w, h)
    torso_mask = _torso_without_arms(img_bgr, person_mask)
    try:
        metrics = measure(lm, person_mask, torso_mask)
        widths_source = "segformer_sin_brazos" if torso_mask is not None else "silueta_mediapipe"
    except ValueError:
        # SegFormer recortó de más (p. ej. confundió el torso con un brazo): silueta completa
        metrics, widths_source = measure(lm, person_mask), "silueta_mediapipe"
    cls = classify(metrics)
    # Ropa holgada: la silueta en la cadera es mucho más ancha que la distancia entre las articulaciones.
    # Con ropa ajustada la relación ronda 2,0-2,1; por encima de LOOSE_HIP_RATIO la medida no es fiable.
    hip_joints = float(np.linalg.norm(lm[L_HIP] - lm[R_HIP]))
    looseness = metrics["hipWidthPx"] / hip_joints if hip_joints > 1 else 0.0
    metrics["hipLooseness"] = looseness
    warnings = []
    if looseness > LOOSE_HIP_RATIO:
        cls["confidence"] = round(min(cls["confidence"] * 0.6, 0.6), 3)
        warnings.append("Tu ropa parece holgada en la cadera, así que la silueta es aproximada. Para una medida más precisa usa ropa ajustada.")
    info = SILHOUETTES[cls["bodyType"]]
    tips = []
    if metrics["legToBody"] < 0.55:
        tips.append("Las prendas de tiro alto y el calzado del mismo tono que el pantalón alargan la pierna.")
    elif metrics["legToBody"] > 0.62:
        tips.append("Los cinturones y las prendas que marcan la cintura equilibran la línea vertical.")
    return jsonable({
        "modelVersion": VERSION,
        "bodyType": cls["bodyType"],
        "confidence": cls["confidence"],
        "description": info["description"],
        "verticality": cls["verticality"],
        "metrics": {k: round(float(v), 3) for k, v in metrics.items()},
        "recommendations": {
            "lines": info["lines"], "cuts": info["cuts"], "necklines": info["necklines"],
            "lengths": info["lengths"], "structures": info["structures"], "tips": tips,
        },
        "kibbeInspiration": info["kibbe"],
        "warnings": warnings,
        "note": "Describe proporciones para elegir prendas; no es una valoración de tu cuerpo.",
        "parameters": {
            "landmarks": "MediaPipe Pose Landmarker (33 puntos)",
            "widths": "ancho de la máscara de persona a la altura de hombros, cintura (mínimo) y cadera (máximo)",
            "widthsSource": widths_source,
        },
    })
