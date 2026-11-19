"""HU-002: análisis facial geométrico con MediaPipe Face Landmarker (478 puntos).

Mide proporciones (largo/ancho, mandíbula, frente), estima la forma del rostro con un
clasificador de prototipos (distancia normalizada + softmax = confianza) y devuelve los
parámetros usados para que las recomendaciones sean explicables.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import math

import numpy as np

from app.analyzers import mp_runtime as mpr
from app.analyzers.imaging import jsonable
from app.analyzers.quality import face_geometry

VERSION = "face-geometry-1.0.0"

# Índices FaceMesh usados
TOP, CHIN = 10, 152
CHEEK_L, CHEEK_R = 234, 454
JAW_L, JAW_R = 172, 397
FORE_L, FORE_R = 54, 284
MIRROR_PAIRS = [(33, 263), (133, 362), (61, 291), (234, 454), (172, 397), (70, 300), (105, 334), (50, 280)]

# Prototipos (ratio largo/ancho, mandíbula/pómulos, frente/pómulos) calibrados con FaceMesh
PROTOTYPES: Dict[str, tuple] = {
    "Redondo": (1.05, 0.80, 0.88),
    "Cuadrado": (1.08, 0.88, 0.92),
    "Ovalado": (1.20, 0.78, 0.88),
    "Rectangular": (1.35, 0.86, 0.92),
    "Corazon": (1.18, 0.72, 0.95),
    "Diamante": (1.20, 0.74, 0.82),
}
SIGMA = np.array([0.06, 0.04, 0.04])

DESCRIPTIONS = {
    "Ovalado": "Rostro algo más largo que ancho, con frente y mandíbula equilibradas y contorno suave.",
    "Redondo": "Largo y ancho parecidos, con pómulos llenos y mandíbula suave.",
    "Cuadrado": "Largo y ancho parecidos, con mandíbula marcada y ancha.",
    "Rectangular": "Rostro alargado, con frente, pómulos y mandíbula de anchura similar.",
    "Corazon": "Frente más ancha que la mandíbula y mentón estrecho.",
    "Diamante": "Pómulos como zona más ancha, con frente y mandíbula más estrechas.",
}

RECOMMENDATIONS: Dict[str, Dict[str, List[str]]] = {
    "Ovalado": {
        "cortes": ["Bob recto clásico", "Capas largas en V", "Corte mariposa"],
        "evitarCortes": ["Flequillo muy pesado que acorte la frente"],
        "gafas": ["Casi todas las monturas; prueba rectangulares o cat-eye suaves"],
        "evitarGafas": ["Monturas demasiado grandes que tapen las cejas"],
        "escotes": ["En V", "Barco", "Redondo"],
        "accesorios": ["Aretes de cualquier forma; prueba aros medianos"],
    },
    "Redondo": {
        "cortes": ["Capas largas con volumen arriba", "Bob largo angular", "Shaggy texturizado"],
        "evitarCortes": ["Bob redondo a la altura de las mejillas", "Flequillo recto corto"],
        "gafas": ["Rectangulares", "Cat-eye angular", "Wayfarer"],
        "evitarGafas": ["Redondas pequeñas"],
        "escotes": ["En V profundo", "Cuello alargado o abierto"],
        "accesorios": ["Aretes largos y lineales", "Collares largos en Y"],
    },
    "Cuadrado": {
        "cortes": ["Capas largas desfiladas", "Flequillo cortina abierto", "Ondas suaves"],
        "evitarCortes": ["Bob recto a la altura de la mandíbula"],
        "gafas": ["Redondas", "Ovaladas", "Aviador curvo"],
        "evitarGafas": ["Cuadradas pesadas"],
        "escotes": ["Redondo", "Corazón", "En U"],
        "accesorios": ["Aros redondos", "Aretes con curvas"],
    },
    "Rectangular": {
        "cortes": ["Flequillo recto o de cortina", "Volumen a los lados", "Bob a la mandíbula"],
        "evitarCortes": ["Pelo muy largo y lacio sin volumen", "Volumen en la coronilla"],
        "gafas": ["Monturas anchas y altas", "Oversize redondeadas"],
        "evitarGafas": ["Monturas estrechas y pequeñas"],
        "escotes": ["Barco", "Cuello alto", "Redondo"],
        "accesorios": ["Aretes anchos o tipo botón", "Collares cortos tipo gargantilla"],
    },
    "Corazon": {
        "cortes": ["Bob a la mandíbula", "Capas con volumen abajo", "Flequillo lateral"],
        "evitarCortes": ["Mucho volumen en la coronilla"],
        "gafas": ["Ovaladas", "Al aire en la parte inferior", "Aviador fino"],
        "evitarGafas": ["Monturas con detalles pesados arriba"],
        "escotes": ["En V", "Cuadrado", "Corazón"],
        "accesorios": ["Aretes en forma de lágrima", "Aretes más anchos abajo"],
    },
    "Diamante": {
        "cortes": ["Bob a la clavícula", "Flequillo lateral barrido", "Ondas en las puntas"],
        "evitarCortes": ["Pelo muy pegado a los pómulos"],
        "gafas": ["Ovaladas", "Cat-eye suave", "Sin montura inferior"],
        "evitarGafas": ["Monturas estrechas que marquen los pómulos"],
        "escotes": ["En V", "Corazón", "Cuello alto suave"],
        "accesorios": ["Aretes pegados o tipo gota", "Collares cortos"],
    },
}


def _dist(lm: np.ndarray, a: int, b: int) -> float:
    return float(np.linalg.norm(lm[a] - lm[b]))


def measure(lm: np.ndarray) -> Dict[str, float]:
    length, cheek = _dist(lm, TOP, CHIN), _dist(lm, CHEEK_L, CHEEK_R)
    jaw, fore = _dist(lm, JAW_L, JAW_R), _dist(lm, FORE_L, FORE_R)
    cheek = max(cheek, 1e-6)
    mid_x = (lm[CHEEK_L][0] + lm[CHEEK_R][0]) / 2.0
    asym = [abs((mid_x - lm[a][0]) - (lm[b][0] - mid_x)) / cheek for a, b in MIRROR_PAIRS]
    return {
        "lengthToWidth": length / cheek,
        "jawToCheek": jaw / cheek,
        "foreheadToCheek": fore / cheek,
        "symmetry": float(max(0.0, 1.0 - float(np.mean(asym)) * 4.0)),
    }


def classify(metrics: Dict[str, float]) -> Dict[str, Any]:
    x = np.array([metrics["lengthToWidth"], metrics["jawToCheek"], metrics["foreheadToCheek"]])
    names = list(PROTOTYPES)
    d2 = np.array([float((((x - np.array(PROTOTYPES[n])) / SIGMA) ** 2).sum()) for n in names])
    probs = np.exp(-0.5 * (d2 - d2.min()))
    probs = probs / probs.sum()
    order = np.argsort(-probs)
    best = names[order[0]]
    return {
        "shape": best,
        "confidence": round(float(probs[order[0]]), 3),
        "alternatives": [{"shape": names[i], "probability": round(float(probs[i]), 3)} for i in order[1:3]],
    }


# ---------------------------------------------------------------- Rasgos para maquillaje
# Geometría objetiva sobre los 478 puntos: inclinación de los ojos (ángulo esquina interna ->
# externa, corregido con la inclinación de la cabeza), separación (distancia entre lagrimales /
# ancho del ojo), apertura (alto / ancho del ojo) y labios (alto / ancho; superior / inferior).
# Umbrales relativos a la mediana de 22 rostros (retrato de prueba + fotos de Wikimedia Commons):
# inclinación 5,7°, separación 1,21, apertura 0,35, labios 0,33, superior/inferior 0,60. Los puntos
# de FaceMesh quedan algo por dentro de los ángulos reales del ojo, por eso la separación media
# sale por encima de 1. No se miden rasgos que los puntos no captan bien (párpado encapotado).
EYE_R = (133, 33, 159, 145)   # lagrimal, esquina externa, párpado superior, inferior (ojo derecho)
EYE_L = (362, 263, 386, 374)
LIP_TOP, LIP_UPPER_IN, LIP_LOWER_IN, LIP_BOTTOM, MOUTH_R, MOUTH_L = 0, 13, 14, 17, 61, 291

FEATURE_TIPS = {
    "Caídos": ["Delineado que suba en la esquina externa, sin seguir la curva del párpado inferior.",
               "Sombra más intensa arriba y hacia la sien; poca o ninguna en el párpado inferior externo."],
    "Hacia arriba": ["Delineado fino y recto: el ojo ya tiene elevación natural.",
                     "Puedes llevar sombra en el párpado inferior externo para equilibrar."],
    "Juntos": ["Ilumina el lagrimal y lleva el tono oscuro hacia la esquina externa.",
               "Empieza el delineado a partir de la mitad del párpado."],
    "Separados": ["Lleva algo de sombra oscura hacia el lagrimal.", "Delineado completo, desde la esquina interna."],
    "Rasgados": ["Ilumina el centro del párpado móvil para abrir la mirada.", "Máscara de pestañas sobre todo en el centro."],
    "Grandes / redondos": ["Delineado alargado hacia fuera para estilizar.", "Sombra difuminada en la esquina externa."],
    "Finos": ["Perfilador del tono natural, apenas por fuera del borde.", "Brillo o tonos medios en el centro del labio; evita mates muy oscuros."],
    "Gruesos": ["Cualquier acabado; los tonos oscuros y mates lucen especialmente.", "Perfila por dentro del borde si buscas un efecto más sutil."],
    "Superior fino": ["Perfila ligeramente el arco de Cupido y aplica un punto de brillo en el centro del labio superior."],
}


def _eye_tilt(lm: np.ndarray, inner: int, outer: int, sign: int, ref_deg: float) -> float:
    ang = math.degrees(math.atan2(-(lm[outer][1] - lm[inner][1]), sign * (lm[outer][0] - lm[inner][0])))
    return ang + sign * ref_deg


def facial_features(lm: np.ndarray) -> Dict[str, Any]:
    """Rasgos de ojos y labios medidos sobre los puntos de MediaPipe, con consejos de maquillaje."""
    ref = math.degrees(math.atan2(lm[EYE_L[0]][1] - lm[EYE_R[0]][1], lm[EYE_L[0]][0] - lm[EYE_R[0]][0]))
    tilt = (_eye_tilt(lm, EYE_R[0], EYE_R[1], -1, ref) + _eye_tilt(lm, EYE_L[0], EYE_L[1], 1, ref)) / 2
    eye_w = max(1e-6, (_dist(lm, EYE_R[0], EYE_R[1]) + _dist(lm, EYE_L[0], EYE_L[1])) / 2)
    spacing = _dist(lm, EYE_R[0], EYE_L[0]) / eye_w
    openness = (_dist(lm, EYE_R[2], EYE_R[3]) + _dist(lm, EYE_L[2], EYE_L[3])) / 2 / eye_w
    lips = _dist(lm, LIP_TOP, LIP_BOTTOM) / max(1e-6, _dist(lm, MOUTH_R, MOUTH_L))
    upper_lower = _dist(lm, LIP_TOP, LIP_UPPER_IN) / max(1e-6, _dist(lm, LIP_LOWER_IN, LIP_BOTTOM))

    eye_tilt = "Caídos" if tilt < 2.0 else "Hacia arriba" if tilt > 9.5 else "Horizontales"
    eye_spacing = "Juntos" if spacing < 1.08 else "Separados" if spacing > 1.36 else "Equilibrados"
    eye_size = "Rasgados" if openness < 0.26 else "Grandes / redondos" if openness > 0.43 else "Medios"
    lip_volume = "Finos" if lips < 0.25 else "Gruesos" if lips > 0.44 else "Medios"
    tips: List[str] = []
    for trait in (eye_tilt, eye_spacing, eye_size, lip_volume):
        tips += FEATURE_TIPS.get(trait, [])
    if upper_lower < 0.45 and lip_volume != "Gruesos":
        tips += FEATURE_TIPS["Superior fino"]
    return {
        "eyes": {"tilt": eye_tilt, "spacing": eye_spacing, "size": eye_size},
        "lips": {"volume": lip_volume, "upperThin": bool(upper_lower < 0.45)},
        "metrics": {
            "eyeTiltDeg": round(tilt, 1), "eyeSpacing": round(spacing, 3), "eyeOpenness": round(openness, 3),
            "lipHeightToWidth": round(lips, 3), "upperToLowerLip": round(upper_lower, 3),
        },
        "makeupTips": tips,
    }


def analyze(img_bgr: np.ndarray, lm_px: Optional[np.ndarray] = None) -> Dict[str, Any]:
    h, w = img_bgr.shape[:2]
    det_conf = None
    if lm_px is None:
        res = mpr.detect_faces(img_bgr)
        if not res.face_landmarks:
            raise ValueError("No se detectó un rostro en la imagen.")
        lm_px = mpr.landmarks_px(res.face_landmarks[0], w, h)
    metrics = measure(lm_px)
    cls = classify(metrics)
    geo = face_geometry(lm_px)
    # La confianza final penaliza poses no frontales
    pose_factor = max(0.5, 1.0 - geo["yaw"] * 2.0 - geo["roll"] / 90.0)
    confidence = round(float(cls["confidence"] * pose_factor), 3)
    shape = cls["shape"]
    return jsonable({
        "modelVersion": VERSION,
        "faceShape": shape,
        "confidence": confidence,
        "description": DESCRIPTIONS[shape],
        "alternatives": cls["alternatives"],
        "metrics": {k: round(v, 3) for k, v in metrics.items()},
        "pose": {"yaw": round(geo["yaw"], 3), "rollDeg": round(geo["roll"], 1)},
        "parameters": {
            "landmarks": "MediaPipe Face Landmarker (478 puntos)",
            "lengthToWidth": "distancia frente(10)-mentón(152) / pómulos(234-454)",
            "jawToCheek": "ángulos de mandíbula(172-397) / pómulos",
            "foreheadToCheek": "sienes(54-284) / pómulos",
            "detectionConfidence": det_conf,
        },
        "recommendations": RECOMMENDATIONS[shape],
        # Con la cara girada, la separación y la inclinación de los ojos se deforman
        "features": {**facial_features(lm_px), "reliable": bool(geo["yaw"] < 0.12 and geo["roll"] < 12)},
        "landmarks": [[round(float(p[0]) / w, 4), round(float(p[1]) / h, 4)] for p in lm_px[::6]],
    })
