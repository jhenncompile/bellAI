"""
HU-023: textura de piel del avatar.

- Tiñe la piel base de MakeHuman (CC0) al tono de la usuaria (desplazamiento en Lab).
- Pega su cara: los puntos de la cara del modelo (ojos, nariz, boca, barbilla, pómulos) se alinean
  con los de MediaPipe en la foto de frente (thin-plate spline) y cada triángulo de la cara del
  modelo se copia de la foto a su sitio en la textura (UV). El borde se funde con la piel.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, Optional, Tuple

import cv2
import numpy as np

from app.analyzers import human_model as hm

# Puntos de MediaPipe Face Landmarker que casan con face_keypoints del modelo
MP_POINTS = {"ojo_d": [468], "ojo_i": [473], "nariz": [1], "boca": [13, 14], "barbilla": [152], "lado_d": [234], "lado_i": [454]}
FACE_OVAL_MP = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149,
                150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
TEX_SIZE = 2048


@lru_cache(maxsize=1)
def _base_skin() -> np.ndarray:
    img = cv2.imread(f"{hm.TEX_DIR}/piel_base.png", cv2.IMREAD_COLOR)
    if img is None:
        raise hm.HumanModelMissing()
    if img.shape[0] != TEX_SIZE:
        img = cv2.resize(img, (TEX_SIZE, TEX_SIZE), interpolation=cv2.INTER_CUBIC)
    return img


@lru_cache(maxsize=1)
def _coverage() -> np.ndarray:
    """Píxeles de la textura que usa el cuerpo (para medir el tono de la piel base)."""
    m = hm.load()
    mask = np.zeros((TEX_SIZE, TEX_SIZE), np.uint8)
    uv = _uv_px(m.body_uv)
    for t in m.body_idx[:: 3]:
        cv2.fillConvexPoly(mask, np.round(uv[t]).astype(np.int32), 255)
    return mask > 0


def _uv_px(uv: np.ndarray) -> np.ndarray:
    return np.stack([uv[:, 0] * TEX_SIZE, (1 - uv[:, 1]) * TEX_SIZE], axis=1)


def _lab(rgb) -> np.ndarray:
    px = np.uint8([[np.clip(rgb, 0, 255)[::-1]]])
    return cv2.cvtColor(px, cv2.COLOR_BGR2LAB)[0, 0].astype(np.float64)


def tint_skin(skin_rgb) -> np.ndarray:
    """Piel base llevada al tono dado (RGB), conservando el detalle (labios, mejillas, sombras)."""
    base = _base_skin()
    lab = cv2.cvtColor(base, cv2.COLOR_BGR2LAB).astype(np.float64)
    ref = np.median(lab[_coverage()], axis=0)
    shift = _lab(skin_rgb) - ref
    shift[0] *= 0.85
    out = np.clip(lab + shift, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2BGR)


def skin_texture_jpeg(skin_hex: str) -> bytes:
    rgb = [int(skin_hex[i:i + 2], 16) for i in (1, 3, 5)]
    ok, buf = cv2.imencode(".jpg", tint_skin(rgb), [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes()


# ---------------------------------------------------------------- thin-plate spline 2D

def _tps_fit(src: np.ndarray, dst: np.ndarray, reg: float = 1e-6):
    n = len(src)
    d = np.linalg.norm(src[:, None] - src[None], axis=2)
    K = np.where(d > 0, d ** 2 * np.log(d + 1e-12), 0.0) + reg * np.eye(n)
    Pm = np.hstack([np.ones((n, 1)), src])
    A = np.zeros((n + 3, n + 3))
    A[:n, :n], A[:n, n:], A[n:, :n] = K, Pm, Pm.T
    b = np.zeros((n + 3, 2))
    b[:n] = dst
    return src, np.linalg.solve(A, b)


def _tps_apply(model, pts: np.ndarray) -> np.ndarray:
    src, W = model
    d = np.linalg.norm(pts[:, None] - src[None], axis=2)
    U = np.where(d > 0, d ** 2 * np.log(d + 1e-12), 0.0)
    return U @ W[: len(src)] + np.hstack([np.ones((len(pts), 1)), pts]) @ W[len(src):]


def _vertex_normals(P: np.ndarray, tris: np.ndarray) -> np.ndarray:
    n = np.zeros_like(P)
    t = P[tris]
    fn = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def _smooth(x: np.ndarray, a: float, b: float) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def face_texture(model: hm.HumanModel, P: np.ndarray, skin_rgb, photo: np.ndarray, lm: np.ndarray) -> Tuple[np.ndarray, Dict]:
    """
    Textura (BGR, TEX_SIZE²) con la piel teñida y la cara de la foto. `lm`: puntos de MediaPipe
    en píxeles (478, 2+). Devuelve también datos de control (error de alineación).
    """
    tex = tint_skin(skin_rgb)
    kp = hm.face_keypoints(model, P)
    names = list(MP_POINTS)
    src = np.array([kp[n][:2] for n in names])
    dst = np.array([lm[MP_POINTS[n], :2].mean(axis=0) for n in names])
    tps = _tps_fit(src, dst)

    # Vértices de dibujo de la cara: cabeza, de frente, y dentro del óvalo de la foto
    R = P[model.body_map]
    normals = _vertex_normals(R, model.body_idx)
    orig_reg = model.vert_region[model.body_map]
    photo_xy = _tps_apply(tps, R[:, :2])
    oval = lm[FACE_OVAL_MP, :2].astype(np.float64)
    center = oval.mean(axis=0)
    shrunk = (center + (oval - center) * 0.96).astype(np.float32).reshape(-1, 1, 2)
    face_w = np.linalg.norm(lm[234, :2] - lm[454, :2])
    inside = np.array([cv2.pointPolygonTest(shrunk, (float(x), float(y)), True) for x, y in photo_xy])
    weight = _smooth(inside, 0, 0.08 * face_w) * _smooth(normals[:, 2], 0.15, 0.45)
    weight[orig_reg != model.regions["cabeza"]] = 0
    # Sin los ojos de la foto: el modelo tiene sus globos oculares y saldrían ojos dobles
    for e in ("ojo_d", "ojo_i"):
        de = np.linalg.norm(R[:, :2] - kp[e][:2], axis=1)
        weight *= _smooth(de, 0.0105, 0.016)
    h, w = photo.shape[:2]
    weight[(photo_xy[:, 0] < 0) | (photo_xy[:, 1] < 0) | (photo_xy[:, 0] >= w) | (photo_xy[:, 1] >= h)] = 0

    layer = np.zeros_like(tex)
    mask = np.zeros(tex.shape[:2], np.float32)
    uv = _uv_px(model.body_uv)
    for t in model.body_idx:
        wt = weight[t]
        if wt.max() <= 0.01:
            continue
        d = uv[t].astype(np.float32)
        s = photo_xy[t].astype(np.float32)
        x0, y0 = np.floor(d.min(axis=0)).astype(int) - 1
        x1, y1 = np.ceil(d.max(axis=0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, TEX_SIZE), min(y1, TEX_SIZE)
        if x1 <= x0 or y1 <= y0:
            continue
        M = cv2.getAffineTransform(s, d - np.array([x0, y0], np.float32))
        patch = cv2.warpAffine(photo, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        tri_mask = np.zeros((y1 - y0, x1 - x0), np.uint8)
        cv2.fillConvexPoly(tri_mask, np.round(d - [x0, y0]).astype(np.int32), 1)
        sel = tri_mask > 0
        layer[y0:y1, x0:x1][sel] = patch[sel]
        mask[y0:y1, x0:x1][sel] = np.maximum(mask[y0:y1, x0:x1][sel], float(wt.mean()))
    covered = mask > 0
    if covered.any():
        # Rellena 2 px por fuera para que el difuminado no traiga negro
        dil = cv2.dilate(layer, np.ones((5, 5), np.uint8))
        layer = np.where(covered[:, :, None], layer, dil)
        mask = cv2.GaussianBlur(mask, (0, 0), TEX_SIZE / 400)
        # Igualar el tono de la cara al de la piel teñida en el borde (evita una «máscara»)
        ring = (mask > 0.15) & (mask < 0.6)
        if ring.sum() > 50:
            lab_l = cv2.cvtColor(layer, cv2.COLOR_BGR2LAB).astype(np.float64)
            lab_t = cv2.cvtColor(tex, cv2.COLOR_BGR2LAB).astype(np.float64)
            diff = lab_t[ring].mean(axis=0) - lab_l[ring].mean(axis=0)
            lab_l = np.clip(lab_l + diff * 0.8, 0, 255).astype(np.uint8)
            layer = cv2.cvtColor(lab_l, cv2.COLOR_LAB2BGR)
        m3 = mask[:, :, None]
        tex = (layer.astype(np.float32) * m3 + tex.astype(np.float32) * (1 - m3)).astype(np.uint8)
    err = np.linalg.norm(_tps_apply(tps, src) - dst, axis=1).max() / max(face_w, 1)
    return tex, {"faceTriangles": int((weight[model.body_idx].max(axis=1) > 0.01).sum()), "alignError": round(float(err), 4)}


def eye_color(photo: np.ndarray, lm: np.ndarray) -> str:
    """Textura de ojos más parecida al iris de la foto."""
    if len(lm) < 478:
        return "brown"
    hsv = cv2.cvtColor(photo, cv2.COLOR_BGR2HSV)
    samples = []
    for c, ring in ((468, range(469, 473)), (473, range(474, 478))):
        r = np.mean([np.linalg.norm(lm[i, :2] - lm[c, :2]) for i in ring])
        mask = np.zeros(photo.shape[:2], np.uint8)
        cv2.circle(mask, tuple(np.round(lm[c, :2]).astype(int)), max(1, int(r * 0.75)), 1, -1)
        cv2.circle(mask, tuple(np.round(lm[c, :2]).astype(int)), max(1, int(r * 0.3)), 0, -1)  # sin la pupila
        if mask.sum():
            samples.append(hsv[mask > 0])
    if not samples:
        return "brown"
    s = np.concatenate(samples)
    hue, sat, val = np.median(s[:, 0]), np.median(s[:, 1]), np.median(s[:, 2])
    if val < 85 or (hue < 30 and sat > 60 and val < 120):
        return "brown"
    if hue < 30 or hue > 160:
        return "brownlight"
    if sat < 45:
        return "grey"
    if hue < 80:
        return "green"
    if hue < 95:
        return "bluegreen"
    return "blue" if val < 170 else "lightblue"


def encode_jpeg(img: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()
