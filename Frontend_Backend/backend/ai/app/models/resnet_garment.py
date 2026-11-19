"""
Armario Digital: tipo de prenda con ResNet-34 (pesos de ImageNet, `resnet34_pretrained.pt`).

ImageNet ya incluye clases de ropa y calzado ("jean", "miniskirt", "trench coat", "running shoe"…).
Se ejecuta la red completa, se toma la distribución softmax de las 1000 clases y se suma la
probabilidad de las clases que corresponden a cada subcategoría del armario. La confianza que se
devuelve es esa probabilidad real, no un valor fijo.

Limitación conocida: ImageNet no distingue blusa de camisa ni tiene tacones o pantalón de vestir.
Para esos casos el servicio combina el resultado con CLIP (ver `vision.py`).
"""
from __future__ import annotations

import threading
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import torch
import torch.nn as nn

from app.models.weights import imagenet_categories, load_resnet34

# Subcategoría del armario -> clases de ImageNet que la representan
IMAGENET_TO_SUBCATEGORY: Dict[str, List[str]] = {
    "jeans": ["jean"],
    "camisetas": ["jersey"],
    "sueteres": ["sweatshirt", "cardigan"],
    "abrigos": ["trench coat", "fur coat", "poncho"],
    "chaquetas": ["lab coat"],
    "blazers": ["suit"],
    "faldas": ["miniskirt", "hoopskirt", "overskirt"],
    "vestidos": ["gown", "abaya"],
    "tops": ["brassiere", "maillot", "bikini"],
    "shorts": ["swimming trunks"],
    "zapatillas": ["running shoe"],
    "botas": ["cowboy boot"],
    "sandalias": ["sandal"],
}

_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


class ResNetGarmentClassifier:
    """Clasificador y extractor de vectores (512 dimensiones) sobre el mismo ResNet-34."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Optional[nn.Module] = None
        self._features: Optional[nn.Module] = None
        self._class_index: Dict[str, List[int]] = {}

    def _ensure(self) -> None:
        if self._model is not None:
            return
        model = load_resnet34()
        cats = imagenet_categories()
        index: Dict[str, List[int]] = {}
        for sub, names in IMAGENET_TO_SUBCATEGORY.items():
            ids = [i for i, c in enumerate(cats) if c in names]
            missing = set(names) - {cats[i] for i in ids}
            if missing:
                raise RuntimeError(f"Clases de ImageNet inexistentes en el mapeo: {sorted(missing)}")
            index[sub] = ids
        self._class_index = index
        # Todo salvo la capa fc: promedio global -> vector de 512 dimensiones
        self._features = nn.Sequential(*list(model.children())[:-1]).eval()
        self._model = model

    @staticmethod
    def garment_view(img_bgr: np.ndarray, mask: Optional[np.ndarray] = None, margin: float = 0.15) -> np.ndarray:
        """
        Encuadre de la prenda con margen. Un recorte pegado al borde de la prenda confunde a la
        red (en pruebas, una gabardina pasaba de "trench coat" 0,80 a "hammer"), así que se deja
        un 15 % de aire alrededor.
        """
        if mask is None:
            return img_bgr
        x, y, w, h = cv2.boundingRect((mask > 0).astype(np.uint8))
        if w < 10 or h < 10:
            return img_bgr
        H, W = img_bgr.shape[:2]
        dx, dy = int(w * margin), int(h * margin)
        return img_bgr[max(0, y - dy):min(H, y + h + dy), max(0, x - dx):min(W, x + w + dx)]

    @staticmethod
    def to_tensor(img_bgr: np.ndarray) -> torch.Tensor:
        """Preprocesado estándar de ImageNet: lado corto a 256, recorte central 224x224 y normalización."""
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h, w = rgb.shape[:2]
        scale = 256.0 / min(h, w)
        rgb = cv2.resize(rgb, (max(224, round(w * scale)), max(224, round(h * scale))), interpolation=cv2.INTER_AREA)
        h, w = rgb.shape[:2]
        y, x = (h - 224) // 2, (w - 224) // 2
        return _normalize(rgb[y:y + 224, x:x + 224])

    @staticmethod
    def to_tensor_padded(img_bgr: np.ndarray) -> torch.Tensor:
        """Imagen entera rellenada a un cuadrado con el color de su borde: no corta la prenda."""
        h, w = img_bgr.shape[:2]
        side = max(h, w)
        border = np.concatenate([img_bgr[0], img_bgr[-1], img_bgr[:, 0], img_bgr[:, -1]])
        fill = [int(v) for v in np.median(border, axis=0)]
        top, left = (side - h) // 2, (side - w) // 2
        square = cv2.copyMakeBorder(img_bgr, top, side - h - top, left, side - w - left, cv2.BORDER_CONSTANT, value=fill)
        return _normalize(cv2.cvtColor(cv2.resize(square, (224, 224), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB))

    def _views(self, img_bgr: np.ndarray, mask: Optional[np.ndarray]) -> torch.Tensor:
        """
        Dos vistas de la misma foto (test-time augmentation): el recorte central de la foto
        completa y la prenda encuadrada sin cortes. En pruebas con fotos reales ninguna de las dos
        acierta siempre por sí sola; promediadas, sí.
        """
        return torch.cat([self.to_tensor(img_bgr), self.to_tensor_padded(self.garment_view(img_bgr, mask))])

    def classify(self, img_bgr: np.ndarray, mask: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """
        Devuelve la subcategoría con más probabilidad acumulada y el reparto completo.
        `garmentProbability` es la probabilidad total asignada a clases de ropa: si es baja,
        la red no reconoce una prenda en la foto y el resultado no debe usarse solo.
        """
        with self._lock:
            self._ensure()
            x = self._views(img_bgr, mask)
            with torch.no_grad():
                probs = torch.softmax(self._model(x), dim=1).mean(dim=0)
        cats = imagenet_categories()
        per_sub = {sub: float(probs[ids].sum()) for sub, ids in self._class_index.items()}
        ranked = sorted(per_sub.items(), key=lambda kv: -kv[1])
        garment_total = float(sum(per_sub.values()))
        top5 = torch.topk(probs, 5)
        return {
            "subcategory": ranked[0][0],
            "probability": round(ranked[0][1], 4),
            "garmentProbability": round(garment_total, 4),
            "ranking": [{"subcategory": s, "probability": round(p, 4)} for s, p in ranked[:4]],
            # Reparto completo entre subcategorías (para combinarlo con CLIP y SegFormer)
            "distribution": per_sub,
            "imagenetTop5": [
                {"label": cats[i], "probability": round(float(v), 4)}
                for v, i in zip(top5.values.tolist(), top5.indices.tolist())
            ],
        }

    def embed(self, img_bgr: np.ndarray, mask: Optional[np.ndarray] = None) -> np.ndarray:
        """Vector de características de 512 dimensiones (promedio de las dos vistas, norma L2 = 1)."""
        with self._lock:
            self._ensure()
            x = self._views(img_bgr, mask)
            with torch.no_grad():
                v = torch.flatten(self._features(x), 1).mean(dim=0)
        v = v / (v.norm() + 1e-8)
        return v.numpy()


def _normalize(rgb: np.ndarray) -> torch.Tensor:
    t = torch.from_numpy(np.ascontiguousarray(rgb)).float().permute(2, 0, 1) / 255.0
    return ((t - _MEAN) / _STD).unsqueeze(0)


RESNET_GARMENT = ResNetGarmentClassifier()
