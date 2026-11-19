"""
Modelos ONNX específicos de dominio, ejecutados con onnxruntime (el mismo archivo .onnx sirve en el
teléfono con onnxruntime-react-native).

| Modelo | Archivo | Arquitectura y datos | Licencia | Uso |
|---|---|---|---|---|
| Face parsing | face_parsing_resnet18.onnx (53 MB) | BiSeNet con backbone ResNet-18, entrenado en CelebAMask-HQ (19 clases: piel, cejas, ojos, gafas, nariz, labios, cabello, sombrero…) — github.com/yakhyo/face-parsing | MIT | Colorimetría (HU-004), cabello (HU-006/HU-019) |
| Ropa puesta | segformer_b2_clothes.onnx (110 MB) | SegFormer-B2 entrenado en ATR (18 clases: prenda superior, falda, pantalón, vestido, zapatos, bolso…) — huggingface.co/mattmdjaga/segformer_b2_clothes | NVIDIA SegFormer (uso no comercial / investigación) | Prendas que lleva puestas la usuaria (HU-010, HU-024) |

Si falta el archivo o onnxruntime, `is_available()` devuelve False y los analizadores siguen con
MediaPipe; nunca se inventa una segmentación.
"""
from __future__ import annotations

import os
import threading
from typing import Dict, Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings

try:  # onnxruntime es opcional: sin él se usan los modelos de MediaPipe
    import onnxruntime as ort
except ImportError:  # pragma: no cover - depende del entorno
    ort = None

FILES = {
    "face_parsing": "face_parsing_resnet18.onnx",
    "clothes_parsing": "segformer_b2_clothes.onnx",
}

# Clases de face parsing (CelebAMask-HQ)
FP_SKIN, FP_L_BROW, FP_R_BROW, FP_L_EYE, FP_R_EYE, FP_GLASSES = 1, 2, 3, 4, 5, 6
FP_NOSE, FP_MOUTH, FP_U_LIP, FP_L_LIP, FP_NECK, FP_CLOTH, FP_HAIR, FP_HAT = 10, 11, 12, 13, 14, 16, 17, 18

# Clases de ropa (ATR)
CLOTHES_LABELS = {
    1: "sombrero", 2: "cabello", 3: "gafas_de_sol", 4: "prenda_superior", 5: "falda", 6: "pantalon",
    7: "vestido", 8: "cinturon", 9: "zapato_izquierdo", 10: "zapato_derecho", 11: "rostro",
    12: "pierna_izquierda", 13: "pierna_derecha", 14: "brazo_izquierdo", 15: "brazo_derecho",
    16: "bolso", 17: "bufanda",
}

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
_sessions: Dict[str, object] = {}
_lock = threading.Lock()


def model_path(name: str) -> str:
    return os.path.join(settings.MODELS_DIR, FILES[name])


def is_available(name: str) -> bool:
    return ort is not None and os.path.exists(model_path(name))


def status() -> Dict[str, bool]:
    return {name: is_available(name) for name in FILES}


def _session(name: str):
    with _lock:
        if name not in _sessions:
            if not is_available(name):
                raise RuntimeError(f"Modelo ONNX '{FILES[name]}' no disponible.")
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = max(1, (os.cpu_count() or 2) // 2)
            _sessions[name] = ort.InferenceSession(model_path(name), sess_options=opts, providers=["CPUExecutionProvider"])
        return _sessions[name]


def _tensor(img_bgr: np.ndarray, size: int) -> np.ndarray:
    rgb = cv2.cvtColor(cv2.resize(img_bgr, (size, size), interpolation=cv2.INTER_LINEAR), cv2.COLOR_BGR2RGB)
    x = (rgb.astype(np.float32) / 255.0 - _MEAN) / _STD
    return x.transpose(2, 0, 1)[None].astype(np.float32)


def face_box(lm_px: np.ndarray, shape: Tuple[int, int], scale: float = 1.9) -> Tuple[int, int, int, int]:
    """Recuadro cuadrado alrededor del rostro, con margen para cabello y cuello (como CelebAMask-HQ)."""
    h, w = shape[:2]
    x0, y0 = lm_px.min(axis=0)
    x1, y1 = lm_px.max(axis=0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 - 0.1 * (y1 - y0)
    side = max(x1 - x0, y1 - y0) * scale
    l, t = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
    r, b = int(min(w, cx + side / 2)), int(min(h, cy + side / 2))
    return l, t, r, b


def parse_face(img_bgr: np.ndarray, lm_px: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Mapa (H,W) uint8 con la clase de cada píxel (FP_*). Si se dan los puntos del rostro, el modelo
    se aplica sobre un recorte centrado en la cara, que es como fue entrenado; fuera del recorte es 0.
    """
    h, w = img_bgr.shape[:2]
    l, t, r, b = face_box(lm_px, img_bgr.shape) if lm_px is not None else (0, 0, w, h)
    crop = img_bgr[t:b, l:r]
    if crop.size == 0:
        crop, (l, t, r, b) = img_bgr, (0, 0, w, h)
    sess = _session("face_parsing")
    logits = sess.run(None, {sess.get_inputs()[0].name: _tensor(crop, 512)})[0][0]
    labels = logits.argmax(0).astype(np.uint8)
    out = np.zeros((h, w), np.uint8)
    out[t:b, l:r] = cv2.resize(labels, (r - l, b - t), interpolation=cv2.INTER_NEAREST)
    return out


def parse_clothes(img_bgr: np.ndarray) -> np.ndarray:
    """Mapa (H,W) uint8 con las clases de CLOTHES_LABELS (0 = fondo)."""
    h, w = img_bgr.shape[:2]
    sess = _session("clothes_parsing")
    logits = sess.run(None, {sess.get_inputs()[0].name: _tensor(img_bgr, 512)})[0][0]
    # Las logits salen a 1/4 de resolución: se escalan antes del argmax para bordes suaves, a un
    # tamaño de trabajo acotado (18 canales a resolución completa ocuparían cientos de MB)
    s = min(1.0, 640.0 / max(h, w))
    ww, wh = max(1, int(w * s)), max(1, int(h * s))
    up = np.stack([cv2.resize(c, (ww, wh), interpolation=cv2.INTER_LINEAR) for c in logits])
    return cv2.resize(up.argmax(0).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
