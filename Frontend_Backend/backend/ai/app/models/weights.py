"""
Localización y carga de los pesos PyTorch del servicio.

Antes cada gestor buscaba sus `.pt` sólo en `MODELS_DIR`. En Docker esa variable apunta a
`/app/models` (donde `download_models.py` deja MediaPipe y CLIP), pero los `.pt` del repositorio
están en `app/models/checkpoints`: no se encontraban, la red quedaba con pesos aleatorios y la
respuesta seguía diciendo `resnet34_pretrained.pt`. Aquí se busca en ambos sitios y, si un peso
falta o no encaja, se informa con un error en vez de seguir en silencio.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Dict, List

import torch
from torchvision.models import ResNet34_Weights, resnet34

from app.core.config import settings

log = logging.getLogger(__name__)

CHECKPOINTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints")

RESNET34_FILE = "resnet34_pretrained.pt"


class WeightsUnavailableError(RuntimeError):
    """El archivo de pesos no existe o no corresponde a la arquitectura esperada."""


def find_weights(filename: str) -> str:
    """Ruta del archivo en MODELS_DIR o en app/models/checkpoints (en ese orden)."""
    for folder in (settings.MODELS_DIR, CHECKPOINTS_DIR):
        path = os.path.join(folder, filename)
        if os.path.isfile(path):
            return path
    raise WeightsUnavailableError(
        f"No se encontró {filename} en {settings.MODELS_DIR} ni en {CHECKPOINTS_DIR}."
    )


@lru_cache(maxsize=1)
def load_resnet34() -> torch.nn.Module:
    """
    ResNet-34 con los pesos de ImageNet de `resnet34_pretrained.pt` (1000 clases).

    Se carga con `strict=True`: si el archivo no es un ResNet-34 completo, falla en vez de dejar
    capas con pesos aleatorios. Se comparte entre el armario y el recomendador (una sola copia).
    """
    path = find_weights(RESNET34_FILE)
    model = resnet34(weights=None)
    state = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(state, strict=True)
    model.eval()
    log.info("ResNet-34 (ImageNet) cargado desde %s", path)
    return model


def imagenet_categories() -> List[str]:
    """Nombres de las 1000 clases de ImageNet en el orden de la capa de salida."""
    return list(ResNet34_Weights.IMAGENET1K_V1.meta["categories"])


def status() -> Dict[str, bool]:
    """Qué pesos PyTorch están disponibles (para /models y /health)."""
    try:
        find_weights(RESNET34_FILE)
        ok = True
    except WeightsUnavailableError:
        ok = False
    return {"resnet34_imagenet": ok}
