"""Tipo de prenda combinando tres modelos (producto de expertos).

- ResNet-34 (ImageNet): muy fiable en las prendas que ImageNet conoce (jeans, gabardina, zapatilla),
  ciego para blusa, tacones o pantalón de vestir. Su voto se suaviza según `garmentProbability`:
  si la red no ve una prenda, su opinión pesa poco.
- CLIP (MobileCLIP2-S0, zero-shot): cubre las 24 subcategorías.
- SegFormer-B2 (ATR): si la prenda la lleva una persona, sabe si es parte de arriba, falda,
  pantalón o vestido. Restringe las opciones sin elegir entre ellas.

Antes ganaba ResNet siempre que superase un umbral, aunque CLIP opinara distinto con más seguridad:
una chaqueta de cuero negra salía «jeans». Ahora cada modelo vota con su probabilidad.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

# Clase ATR de SegFormer -> subcategorías compatibles
SEGFORMER_TO_SUBS: Dict[int, tuple] = {
    4: ("blusas", "camisas", "camisetas", "tops", "chaquetas", "abrigos", "sueteres", "blazers"),
    5: ("faldas",),
    6: ("pantalones", "jeans", "shorts"),
    7: ("vestidos",),
    17: ("bufandas",),
}
SEGFORMER_MASS = 0.85        # probabilidad repartida entre las subcategorías compatibles
# ResNet pesa la mitad: solo 13 de las 24 subcategorías tienen clase en ImageNet (para chaquetas,
# solo «lab coat») y confunde telas oscuras arrugadas con «jean». Evaluación con 14 fotos reales:
# peso 1,0 -> 13/14 (chaqueta de cuero = jeans); 0,5 -> 14/14.
WEIGHTS = {"resnet": 0.5, "clip": 1.0, "segformer": 1.0}


def fuse(
    subcategories: List[str],
    resnet: Optional[Dict[str, float]] = None,
    resnet_garment_prob: float = 0.0,
    clip: Optional[Dict[str, float]] = None,
    segformer_class: Optional[int] = None,
) -> Dict[str, float]:
    """Probabilidad de cada subcategoría. Los modelos ausentes no votan."""
    n = len(subcategories)
    uniform = np.full(n, 1.0 / n)
    terms = []   # (peso, log-probabilidad)

    if resnet:
        r = np.array([resnet.get(s, 0.0) for s in subcategories])
        r = r / r.sum() if r.sum() > 0 else uniform
        g = float(np.clip(resnet_garment_prob, 0.0, 1.0))
        terms.append((WEIGHTS["resnet"], np.log(g * r + (1 - g) * uniform + 1e-6)))

    if clip:
        c = np.array([clip.get(s, 0.0) for s in subcategories])
        terms.append((WEIGHTS["clip"], np.log(c / max(c.sum(), 1e-9) + 1e-6)))

    allowed = SEGFORMER_TO_SUBS.get(segformer_class or -1)
    if allowed:
        inside = np.array([s in allowed for s in subcategories])
        seg = np.where(inside, SEGFORMER_MASS / inside.sum(), (1 - SEGFORMER_MASS) / max(1, (~inside).sum()))
        terms.append((WEIGHTS["segformer"], np.log(seg)))

    if not terms:
        return dict(zip(subcategories, uniform.tolist()))
    # Los pesos son relativos: un modelo que vota solo conserva su probabilidad sin aplanarla
    top = max(w for w, _ in terms)
    logp = sum((w / top) * lp for w, lp in terms)
    p = np.exp(logp - logp.max())
    p /= p.sum()
    return dict(zip(subcategories, p.tolist()))
