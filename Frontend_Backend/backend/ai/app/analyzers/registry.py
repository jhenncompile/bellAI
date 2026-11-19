"""HU-043 / HU-032: registro de analizadores intercambiables.

Cada analizador declara nombre, tarea, versión y los modelos que necesita. El backend
consulta este registro para mostrar las versiones y comprobar la compatibilidad antes de
activar un modelo. Sustituir un analizador solo exige registrar otra implementación con el
mismo contrato (función analyze) sin tocar el resto del sistema.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List

import numpy as np

from app.analyzers import body, color, face, garment, quality
from app.analyzers import mp_runtime as mpr


@dataclass
class AnalyzerInfo:
    name: str
    task: str
    version: str
    requires: List[str]
    description: str
    smoke: Callable[[], None] = field(repr=False, default=lambda: None)

    def as_dict(self) -> Dict:
        missing = [m for m in self.requires if not mpr.is_available(m)]
        return {
            "name": self.name, "task": self.task, "version": self.version,
            "requires": self.requires, "available": not missing, "missingModels": missing,
            # Archivo concreto en uso (p. ej. pose "full" o "lite"), visible en el panel de modelos (HU-032)
            "modelFiles": {m: mpr.model_file(m) for m in self.requires},
            "description": self.description,
        }


def _blank(h=640, w=480):
    img = np.full((h, w, 3), 128, np.uint8)
    img[::8] = 90
    return img


REGISTRY: Dict[str, AnalyzerInfo] = {
    "quality": AnalyzerInfo("quality", "validacion_foto", quality.VERSION, ["face", "pose"],
                            "Valida iluminación, nitidez, distancia y orientación (HU-035).",
                            lambda: quality.validate(_blank(), "rostro")),
    "face": AnalyzerInfo("face", "analisis_facial", face.VERSION, ["face"],
                         "Forma del rostro y proporciones con 478 landmarks (HU-002).",
                         lambda: mpr.detect_faces(_blank())),
    "colorimetry": AnalyzerInfo("colorimetry", "colorimetria", color.VERSION, ["face", "segmenter"],
                                "Tono, subtono, contraste, estación y paleta (HU-004/006).",
                                lambda: mpr.segment(_blank())),
    "garment": AnalyzerInfo("garment", "clasificacion_prenda",
                            garment.VERSION_CLIP if garment.CLIP.available() else garment.VERSION_HEURISTIC, [],
                            "Categoría, color, estampado y estilo de prendas (HU-010).",
                            lambda: garment.analyze(_blank(320, 320))),
    "body": AnalyzerInfo("body", "analisis_corporal", body.VERSION, ["pose"],
                         "Proporciones de hombros, cintura y cadera (HU-003).",
                         lambda: mpr.detect_pose(_blank())),
}


def register(info: AnalyzerInfo) -> None:
    REGISTRY[info.name] = info


def check(name: str) -> Dict:
    """Comprueba que el analizador puede cargarse y ejecutarse (usado antes de activar un modelo)."""
    if name not in REGISTRY:
        raise KeyError(name)
    info = REGISTRY[name]
    base = info.as_dict()
    if not base["available"]:
        return {**base, "compatible": False, "error": f"Faltan modelos: {', '.join(base['missingModels'])}"}
    start = time.perf_counter()
    try:
        info.smoke()
    except Exception as exc:  # noqa: BLE001
        return {**base, "compatible": False, "error": str(exc)}
    return {**base, "compatible": True, "latencyMs": round((time.perf_counter() - start) * 1000, 1)}
