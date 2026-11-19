"""Utilidades de imagen compartidas por todos los analizadores (decodificación, EXIF, color)."""
from __future__ import annotations

import io
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, ImageOps

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_SIDE = 1280


def decode_image(image_bytes: bytes, max_side: int = MAX_SIDE) -> np.ndarray:
    """Decodifica bytes a BGR aplicando la orientación EXIF y limitando el tamaño."""
    if not image_bytes:
        raise ValueError("La imagen está vacía.")
    try:
        pil = Image.open(io.BytesIO(image_bytes))
        pil = ImageOps.exif_transpose(pil).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise ValueError("No se pudo leer la imagen. Usa un archivo JPG, PNG o WEBP válido.") from exc
    rgb = np.asarray(pil)
    h, w = rgb.shape[:2]
    scale = min(1.0, max_side / float(max(h, w)))
    if scale < 1.0:
        rgb = cv2.resize(rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def original_size(image_bytes: bytes) -> Tuple[int, int]:
    pil = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes)))
    return pil.size  # (ancho, alto)


def gray_world(img_bgr: np.ndarray, strength: float = 0.6) -> np.ndarray:
    """Corrección de balance de blancos 'gray world' atenuada para reducir dominantes de luz."""
    img = img_bgr.astype(np.float32)
    means = img.reshape(-1, 3).mean(axis=0) + 1e-6
    gain = means.mean() / means
    gain = 1.0 + (gain - 1.0) * strength
    return np.clip(img * gain, 0, 255).astype(np.uint8)


def bgr_to_lab_values(pixels_bgr: np.ndarray) -> np.ndarray:
    """Convierte píxeles BGR (N,3) uint8 a CIELAB real (L 0-100, a/b con signo)."""
    if pixels_bgr.size == 0:
        return np.zeros((0, 3), dtype=np.float32)
    lab = cv2.cvtColor(pixels_bgr.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    lab[:, 0] = lab[:, 0] * 100.0 / 255.0
    lab[:, 1] -= 128.0
    lab[:, 2] -= 128.0
    return lab


def robust_lab(pixels_bgr: np.ndarray) -> Tuple[float, float, float]:
    """Mediana LAB descartando el 10% más oscuro y más claro (sombras y brillos)."""
    lab = bgr_to_lab_values(pixels_bgr)
    if len(lab) == 0:
        raise ValueError("No hay píxeles suficientes para medir el color.")
    lo, hi = np.percentile(lab[:, 0], [10, 90])
    keep = lab[(lab[:, 0] >= lo) & (lab[:, 0] <= hi)]
    if len(keep) < 10:
        keep = lab
    L, a, b = np.median(keep, axis=0)
    return float(L), float(a), float(b)


def lab_to_hex(L: float, a: float, b: float) -> str:
    lab = np.array([[[L * 255.0 / 100.0, a + 128.0, b + 128.0]]], dtype=np.float32)
    bgr = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)[0, 0]
    return "#{:02X}{:02X}{:02X}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))


def hex_to_lab(hex_color: str) -> Tuple[float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    L, A, B = bgr_to_lab_values(np.array([[b, g, r]], dtype=np.uint8))[0]
    return float(L), float(A), float(B)


def delta_e(lab1: Tuple[float, float, float], lab2: Tuple[float, float, float]) -> float:
    """Distancia CIE76 entre dos colores LAB."""
    return float(np.sqrt(sum((x - y) ** 2 for x, y in zip(lab1, lab2))))


def dominant_colors(img_bgr: np.ndarray, mask: np.ndarray | None = None, k: int = 3) -> list[dict]:
    """Colores dominantes por k-means en LAB. Devuelve [{hex, lab, share}] ordenado por peso."""
    pixels = img_bgr.reshape(-1, 3) if mask is None else img_bgr[mask > 0]
    if len(pixels) < k * 5:
        pixels = img_bgr.reshape(-1, 3)
    if len(pixels) > 40000:
        idx = np.random.default_rng(7).choice(len(pixels), 40000, replace=False)
        pixels = pixels[idx]
    lab = cv2.cvtColor(pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(lab, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=k)
    out = []
    for i in np.argsort(-counts):
        c = centers[i]
        L, a, b = c[0] * 100.0 / 255.0, c[1] - 128.0, c[2] - 128.0
        out.append({"hex": lab_to_hex(L, a, b), "lab": [round(L, 1), round(a, 1), round(b, 1)], "share": round(float(counts[i] / counts.sum()), 3)})
    return out


def jsonable(obj):
    """Convierte recursivamente tipos numpy a tipos nativos serializables en JSON."""
    if isinstance(obj, dict):
        return {k: jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [jsonable(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return jsonable(obj.tolist())
    return obj
