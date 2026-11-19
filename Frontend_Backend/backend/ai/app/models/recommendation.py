"""
Motor de recomendación de outfits: red siamesa sobre ResNet-34.

Una red siamesa aplica el MISMO codificador (pesos compartidos) a dos entradas y compara sus
vectores. Aquí el codificador es ResNet-34 con pesos de ImageNet (`resnet34_pretrained.pt`) sin la
capa final: cada prenda se convierte en un vector de 512 dimensiones y se comparan con la
similitud coseno.

Qué mide y qué no: la similitud coseno de ResNet-34 mide parecido VISUAL (texturas, formas,
nivel de formalidad aparente). No se entrenó con pares de outfits etiquetados, así que por sí
sola no sabe si dos prendas "combinan". Por eso la compatibilidad combina dos partes que se
devuelven por separado:
- `visualSimilarity`: salida de la red (coseno entre los dos vectores).
- `colorHarmony`: regla de teoría del color sobre los colores medidos en cada prenda.

El antiguo `SimpleRecommender` (embeddings aleatorios indexados con `hash()`, sin entrenar y
distinto en cada arranque) se eliminó junto con /recommendations/predict, que nadie usaba.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

from app.analyzers import garment as garment_analyzer
from app.analyzers.imaging import decode_image, hex_to_lab
from app.models.resnet_garment import RESNET_GARMENT

VERSION = "siamese-resnet34-2.0.0"

# Coseno de vectores ResNet (no negativos tras ReLU): prendas distintas ~0,3; casi iguales ~0,9
_COS_LOW, _COS_HIGH = 0.30, 0.90


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    if va.shape != vb.shape or va.size == 0:
        raise ValueError("Los vectores deben tener la misma dimensión.")
    na, nb = float(np.linalg.norm(va)), float(np.linalg.norm(vb))
    if na == 0 or nb == 0:
        raise ValueError("Vector vacío: la prenda no tiene características.")
    return float(np.dot(va, vb) / (na * nb))


def visual_score(cos: float) -> float:
    """Coseno -> 0..1 dentro del rango que realmente producen las prendas."""
    return float(min(1.0, max(0.0, (cos - _COS_LOW) / (_COS_HIGH - _COS_LOW))))


def _lch(hex_color: str) -> Tuple[float, float, float]:
    L, a, b = hex_to_lab(hex_color)
    return L, math.hypot(a, b), (math.degrees(math.atan2(b, a)) + 360.0) % 360.0


def color_harmony(hex_a: str, hex_b: str) -> Tuple[float, str]:
    """Armonía entre los colores principales de dos prendas (0..1) y la regla aplicada."""
    _, ca, ha = _lch(hex_a)
    _, cb, hb = _lch(hex_b)
    if ca < 15 or cb < 15:
        return 0.9, "base_neutra"
    diff = abs(ha - hb)
    diff = min(diff, 360 - diff)
    if diff <= 30:
        return 0.8, "colores_analogos"
    # En Lab los pares complementarios clásicos (azul/amarillo, verde/rosa) quedan a ~130-150°
    if diff >= 120:
        return 0.75, "colores_complementarios"
    return 0.45, "contraste_arriesgado"


RULE_TEXT = {
    "base_neutra": "Una de las dos prendas es neutra: combina con casi todo.",
    "colores_analogos": "Colores vecinos en el círculo cromático: conjunto armónico y suave.",
    "colores_complementarios": "Colores opuestos: contraste intencional que resalta.",
    "contraste_arriesgado": "Colores que no son vecinos ni opuestos: equilibra con una pieza neutra.",
}


class RecommendationModelManager:
    """Compatibilidad entre prendas con la red siamesa ResNet-34 + armonía de color."""

    def __init__(self, device: str = "cpu"):
        self.device = device

    @staticmethod
    def _garment(image_bytes: bytes) -> Tuple[np.ndarray, str]:
        """Vector de la prenda (rama de la red siamesa) y su color principal medido."""
        img = decode_image(image_bytes)
        mask = garment_analyzer.garment_mask(img)
        main_hex = garment_analyzer.color_analysis(img, mask)["main"]["hex"]
        return RESNET_GARMENT.embed(img, mask), main_hex

    def embed(self, image_bytes: bytes) -> List[float]:
        """Vector de 512 dimensiones de una prenda (rama de la red siamesa)."""
        vec, _ = self._garment(image_bytes)
        return [float(v) for v in vec]

    def match_outfit_compatibility(
        self,
        garment_a_bytes: bytes,
        garment_b_bytes: bytes,
        garment_a_name: str = "Prenda superior",
        garment_b_name: str = "Prenda inferior",
    ) -> Dict[str, Any]:
        # Misma red (pesos compartidos) para las dos ramas
        va, hex_a = self._garment(garment_a_bytes)
        vb, hex_b = self._garment(garment_b_bytes)
        cos = cosine(va, vb)
        vis = visual_score(cos)
        harmony, rule = color_harmony(hex_a, hex_b)
        score = round(100.0 * (0.5 * vis + 0.5 * harmony), 1)

        if score >= 75:
            level = "Alta compatibilidad"
        elif score >= 55:
            level = "Compatibilidad media"
        else:
            level = "Combinación arriesgada"

        return {
            "success": True,
            "model_type": "siamese_resnet34",
            "model_architecture": "Red siamesa: ResNet-34 (ImageNet) con pesos compartidos + similitud coseno",
            "model_version": VERSION,
            "garments": [garment_a_name, garment_b_name],
            "cosineSimilarity": round(cos, 4),
            "visualSimilarity": round(vis, 3),
            "colorHarmony": round(harmony, 3),
            "colorRule": rule,
            "colors": [hex_a, hex_b],
            "compatibilityScore": score,
            "harmonyLevel": level,
            "stylingRule": RULE_TEXT[rule],
            "vectorDimensions": int(va.shape[0]),
        }

    def rank(self, anchor: Sequence[float], candidates: Dict[str, Sequence[float]], top_k: int = 5,
             anchor_hex: Optional[str] = None, candidate_hex: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Ordena prendas candidatas según su compatibilidad con una prenda de referencia usando
        vectores ya calculados (los guarda NestJS al escanear cada prenda).
        """
        ranked = []
        for item_id, vec in candidates.items():
            cos = cosine(anchor, vec)
            vis = visual_score(cos)
            entry: Dict[str, Any] = {"itemId": item_id, "cosineSimilarity": round(cos, 4), "visualSimilarity": round(vis, 3)}
            if anchor_hex and candidate_hex and candidate_hex.get(item_id):
                h, rule = color_harmony(anchor_hex, candidate_hex[item_id])
                entry.update({"colorHarmony": h, "colorRule": rule, "score": round(100 * (0.5 * vis + 0.5 * h), 1)})
            else:
                entry["score"] = round(100 * vis, 1)
            ranked.append(entry)
        ranked.sort(key=lambda e: -e["score"])
        return {"model_type": "siamese_resnet34", "model_version": VERSION, "results": ranked[:top_k]}
