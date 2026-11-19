"""Carga perezosa y segura (un lock por modelo) de los modelos MediaPipe Tasks."""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision as mpv
from mediapipe.tasks.python.components.containers import keypoint as mp_keypoint

from app.core.config import settings

# Clases del segmentador selfie_multiclass_256x256
SEG_BACKGROUND, SEG_HAIR, SEG_BODY_SKIN, SEG_FACE_SKIN, SEG_CLOTHES, SEG_OTHERS = range(6)


@dataclass
class _Slot:
    factory: Callable[[str], Any]
    filename: str
    instance: Any = None
    lock: threading.Lock = threading.Lock()
    # Archivos alternativos, del más preciso al más ligero: se usa el primero descargado
    alternatives: tuple = ()

    def candidates(self) -> tuple:
        return self.alternatives or (self.filename,)


def _face(path: str):
    return mpv.FaceLandmarker.create_from_options(mpv.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=path), num_faces=3,
        min_face_detection_confidence=0.5, running_mode=mpv.RunningMode.IMAGE))


def _pose(path: str):
    return mpv.PoseLandmarker.create_from_options(mpv.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=path), num_poses=2,
        min_pose_detection_confidence=0.5, output_segmentation_masks=True,
        running_mode=mpv.RunningMode.IMAGE))


def _segmenter(path: str):
    return mpv.ImageSegmenter.create_from_options(mpv.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=path), output_category_mask=True,
        output_confidence_masks=False, running_mode=mpv.RunningMode.IMAGE))


def _garment_segmenter(path: str):
    return mpv.InteractiveSegmenterLegacy.create_from_options(mpv.InteractiveSegmenterLegacyOptions(
        base_options=BaseOptions(model_asset_path=path), output_category_mask=False, output_confidence_masks=True))


def _hands(path: str):
    return mpv.HandLandmarker.create_from_options(mpv.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=path), num_hands=2,
        min_hand_detection_confidence=0.4, running_mode=mpv.RunningMode.IMAGE))


_SLOTS: Dict[str, _Slot] = {
    "face": _Slot(_face, "face_landmarker.task", lock=threading.Lock()),
    # HU-003: el modelo "full" ubica mejor hombros y caderas; "lite" queda como respaldo
    "pose": _Slot(_pose, "pose_landmarker_lite.task", lock=threading.Lock(),
                  alternatives=("pose_landmarker_full.task", "pose_landmarker_lite.task")),
    "segmenter": _Slot(_segmenter, "selfie_multiclass_256x256.tflite", lock=threading.Lock()),
    "hands": _Slot(_hands, "hand_landmarker.task", lock=threading.Lock()),
    # HU-010/024/022: recorta el objeto señalado (el centro de la foto) en lugar de GrabCut
    "garment_segmenter": _Slot(_garment_segmenter, "magic_touch.tflite", lock=threading.Lock()),
}


class ModelUnavailableError(RuntimeError):
    """El archivo del modelo no está descargado o no se pudo cargar."""


def model_path(name: str) -> str:
    """Ruta del primer archivo descargado entre los candidatos del modelo."""
    slot = _SLOTS[name]
    for filename in slot.candidates():
        path = os.path.join(settings.MODELS_DIR, filename)
        if os.path.exists(path):
            return path
    return os.path.join(settings.MODELS_DIR, slot.candidates()[-1])


def model_file(name: str) -> str:
    """Nombre del archivo que se usa (o se usaría) para el modelo."""
    return os.path.basename(model_path(name))


def is_available(name: str) -> bool:
    return os.path.exists(model_path(name))


def _run(name: str, fn: Callable[[Any], Any]) -> Any:
    slot = _SLOTS[name]
    with slot.lock:
        if slot.instance is None:
            path = model_path(name)
            if not os.path.exists(path):
                raise ModelUnavailableError(
                    f"Falta el modelo '{os.path.basename(path)}'. Ejecuta scripts/download_models.py."
                )
            slot.instance = slot.factory(path)
        return fn(slot.instance)


def _to_mp(img_bgr: np.ndarray) -> mp.Image:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))


def detect_faces(img_bgr: np.ndarray):
    return _run("face", lambda m: m.detect(_to_mp(img_bgr)))


def detect_pose(img_bgr: np.ndarray):
    return _run("pose", lambda m: m.detect(_to_mp(img_bgr)))


def detect_hands(img_bgr: np.ndarray):
    return _run("hands", lambda m: m.detect(_to_mp(img_bgr)))


def segment(img_bgr: np.ndarray) -> np.ndarray:
    """Máscara de categorías (H,W) uint8 con las clases SEG_* al tamaño de la imagen."""
    def _do(m):
        res = m.segment(_to_mp(img_bgr))
        # Según la versión de MediaPipe llega como (H,W) o (H,W,1): se normaliza a (H,W)
        return res.category_mask.numpy_view().squeeze().copy()
    mask = _run("segmenter", _do)
    if mask.shape[:2] != img_bgr.shape[:2]:
        mask = cv2.resize(mask, (img_bgr.shape[1], img_bgr.shape[0]), interpolation=cv2.INTER_NEAREST)
    return mask.astype(np.uint8)


def segment_object(img_bgr: np.ndarray, x: float = 0.5, y: float = 0.5) -> np.ndarray:
    """
    Probabilidad (H,W) float32 de que cada píxel pertenezca al objeto señalado en (x, y), en
    coordenadas normalizadas. Modelo MediaPipe Interactive Segmenter (magic_touch).
    """
    roi = mpv.InteractiveSegmenterLegacyRegionOfInterest(
        format=mpv.InteractiveSegmenterLegacyRegionOfInterest.Format.KEYPOINT,
        keypoint=mp_keypoint.NormalizedKeypoint(x, y))
    conf = _run("garment_segmenter", lambda m: m.segment(_to_mp(img_bgr), roi).confidence_masks[0].numpy_view().squeeze().copy())
    if conf.shape[:2] != img_bgr.shape[:2]:
        conf = cv2.resize(conf, (img_bgr.shape[1], img_bgr.shape[0]), interpolation=cv2.INTER_LINEAR)
    return conf.astype(np.float32)


def landmarks_px(landmarks, w: int, h: int) -> np.ndarray:
    return np.array([[lm.x * w, lm.y * h] for lm in landmarks], dtype=np.float32)


def status() -> Dict[str, Optional[bool]]:
    return {name: is_available(name) for name in _SLOTS}
