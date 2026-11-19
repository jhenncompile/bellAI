"""Color de una prenda (HU-015): medición robusta + reconocimiento con CLIP.

Por qué no basta con la mediana de los píxeles:
- La luz tiñe la foto: con fluorescentes una blusa rosa palo mide gris beige, y con una bombilla
  cálida unos jeans miden gris. Se corrige el balance de blancos (Shades-of-Gray, p=6) antes de medir.
- Las sombras de los pliegues y los brillos separan una misma tela en varios «colores»: el k-means
  agrupa por tono y croma (a, b) dando menos peso a la luminosidad.
- CIE76 sobrevalora la luminosidad: un denim oscuro quedaba más cerca de «gris oscuro» que de
  «azul marino». Se usa CIEDE2000, que pondera tono y croma como el ojo humano.
- CLIP (MobileCLIP2-S0) reconoce el color con contexto («unos jeans azul marino» incluso con poca
  luz). Su probabilidad se combina con la del color medido; el código hex devuelto es siempre el
  medido (corregido de luz), no uno inventado.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np

from app.analyzers.imaging import bgr_to_lab_values, hex_to_lab, lab_to_hex

# (nombre, hex de referencia, descripción en inglés para CLIP)
PALETTE: List[Tuple[str, str, str]] = [
    ("Negro", "#141414", "black"),
    ("Blanco", "#F5F5F2", "white"),
    ("Crema", "#F0E4CC", "cream ivory"),
    ("Beige", "#D7C2A1", "beige"),
    ("Camel", "#B98B5B", "camel tan"),
    ("Caqui", "#A89A6C", "khaki"),
    ("Marrón", "#6B4423", "brown"),
    ("Chocolate", "#3E2416", "dark chocolate brown"),
    ("Gris claro", "#C6C6C6", "light gray"),
    ("Gris", "#8A8A8A", "gray"),
    ("Gris oscuro", "#474747", "charcoal gray"),
    ("Gris topo", "#8B7D72", "taupe"),
    ("Rojo", "#C21E2B", "red"),
    ("Vino", "#6B1A30", "burgundy wine red"),
    ("Rosa", "#EC6A9A", "pink"),
    ("Rosa pastel", "#F6C1CF", "pastel baby pink"),
    ("Rosa palo", "#D9A7A4", "dusty blush pink"),
    ("Nude", "#E2B9A0", "nude"),
    ("Fucsia", "#D3197A", "fuchsia hot pink"),
    ("Coral", "#F2785F", "coral"),
    ("Salmón", "#F39A86", "salmon"),
    ("Durazno", "#F7C09A", "peach"),
    ("Naranja", "#EE7A1A", "orange"),
    ("Terracota", "#B4532F", "terracotta rust"),
    ("Mostaza", "#C9A227", "mustard yellow"),
    ("Amarillo", "#F5CC1F", "yellow"),
    ("Verde oliva", "#6B6F2E", "olive green"),
    ("Verde militar", "#4B5320", "army green"),
    ("Verde", "#2F8F3A", "green"),
    ("Verde menta", "#A6E3C6", "mint green"),
    ("Esmeralda", "#0C7A55", "emerald green"),
    ("Azul petróleo", "#1C5E6B", "teal"),
    ("Turquesa", "#26B5B0", "turquoise"),
    ("Celeste", "#8CC4E8", "light blue"),
    ("Azul", "#2457B8", "blue"),
    ("Azul marino", "#1D2742", "navy blue"),
    ("Denim", "#3E5C86", "denim blue"),
    ("Lila", "#BFA4D8", "lilac"),
    ("Lavanda", "#C8BFE7", "lavender"),
    ("Morado", "#66308F", "purple"),
]
NAMES = [p[0] for p in PALETTE]
_REF_LAB = np.array([hex_to_lab(p[1]) for p in PALETTE], dtype=np.float64)

# Dispersión (en ΔE00) de cómo se ve un color real en fotos: sombras, tela, compresión JPEG
SIGMA_DE = 9.0
# Peso de CLIP frente a la medida en la combinación logarítmica
CLIP_WEIGHT = 0.5


def ciede2000(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """ΔE CIEDE2000 vectorizado (lab1 (N,3) contra lab2 (M,3) -> (N,M))."""
    L1, a1, b1 = [lab1[:, i][:, None] for i in range(3)]
    L2, a2, b2 = [lab2[:, i][None, :] for i in range(3)]
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cm ** 7 / (Cm ** 7 + 25.0 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(C1p * C2p == 0, 0, dh)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lpm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    hsum = h1p + h2p
    hpm = np.where(np.abs(h1p - h2p) > 180, np.where(hsum < 360, (hsum + 360) / 2, (hsum - 360) / 2), hsum / 2)
    hpm = np.where(C1p * C2p == 0, hsum, hpm)
    T = (1 - 0.17 * np.cos(np.radians(hpm - 30)) + 0.24 * np.cos(np.radians(2 * hpm))
         + 0.32 * np.cos(np.radians(3 * hpm + 6)) - 0.20 * np.cos(np.radians(4 * hpm - 63)))
    dtheta = 30 * np.exp(-(((hpm - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cpm ** 7 / (Cpm ** 7 + 25.0 ** 7))
    Sl = 1 + 0.015 * (Lpm - 50) ** 2 / np.sqrt(20 + (Lpm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    Rt = -np.sin(np.radians(2 * dtheta)) * Rc
    return np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def _to_linear(v: np.ndarray) -> np.ndarray:
    v = v / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def _to_srgb(v: np.ndarray) -> np.ndarray:
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055) * 255.0


def estimate_illuminant(img_bgr: np.ndarray, top: float = 0.01) -> Optional[np.ndarray]:
    """
    Color de la luz con el método de píxeles grises (Yang, Gao y Li, CVPR 2015): en una superficie
    neutra el contraste local es igual en los tres canales (en escala logarítmica), así que esos
    píxeles revelan la luz aunque la foto esté dominada por un fondo de color (una puerta roja, un
    suelo beige). Shades-of-Gray, en cambio, confundía el fondo con la luz.
    Devuelve el iluminante lineal BGR normalizado, o None si no hay píxeles grises fiables.
    """
    h, w = img_bgr.shape[:2]
    s = min(1.0, 320.0 / max(h, w))
    small = cv2.resize(img_bgr, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
    lin = _to_linear(small.astype(np.float64))
    valid = (small.max(axis=2) < 245) & (small.min(axis=2) > 12)
    logc = np.log(lin + 1e-4)
    contrast = np.stack([np.abs(cv2.Laplacian(cv2.GaussianBlur(logc[..., i], (0, 0), 1.0), cv2.CV_64F, ksize=3)) for i in range(3)], -1)
    mean_c = contrast.mean(-1)
    valid &= mean_c > 0.02                      # zonas planas no dicen nada del color de la luz
    if valid.sum() < 100:
        return None
    gi = contrast.std(-1) / (mean_c + 1e-6)     # índice de grisura: 0 = contraste igual en B, G y R
    gi_valid = gi[valid]
    n = max(30, int(top * gi_valid.size))
    idx = np.argsort(gi_valid)[:n]
    px = lin[valid][idx]
    gray_pixels = px.mean(0)
    # Comité de estimadores: cada uno falla en escenas distintas (fondo de color, sombras de una
    # misma superficie, brillos); la mediana por canal es más estable que cualquiera solo.
    ok = (small.max(axis=2) < 245) & (small.max(axis=2) > 12)
    shades = (lin[ok] ** 6).mean(0) ** (1 / 6) if ok.sum() > 100 else gray_pixels
    gx = np.stack([np.hypot(cv2.Sobel(lin[..., i], cv2.CV_64F, 1, 0), cv2.Sobel(lin[..., i], cv2.CV_64F, 0, 1)) for i in range(3)], -1)
    gray_edge = (gx[ok] ** 6).mean(0) ** (1 / 6) if ok.sum() > 100 else gray_pixels
    ests = [e / e.mean() for e in (gray_pixels, shades, gray_edge) if e.min() > 0]
    if not ests:
        return None
    illum = np.median(np.stack(ests), axis=0)
    return illum / illum.mean()


def white_balance(img_bgr: np.ndarray, strength: float = 1.0) -> Tuple[np.ndarray, List[float]]:
    """
    Corrige la dominante de la luz (von Kries en espacio lineal) con el iluminante estimado.
    Las ganancias se acotan (0,7–1,45) para no «inventar» color si la estimación falla.
    En la evaluación (9 prendas x 3 luces) la corrección completa acertó 24/27; al 70 %, 22/27.
    """
    illum = estimate_illuminant(img_bgr)
    if illum is None:
        return img_bgr, [1.0, 1.0, 1.0]
    gains = 1.0 / illum
    gains = 1 + strength * (gains - 1)
    gains = np.clip(gains / gains.mean(), 0.7, 1.45)
    lin = _to_linear(img_bgr.astype(np.float64)) * gains
    out = np.clip(_to_srgb(lin), 0, 255).astype(np.uint8)
    return out, [round(float(g), 3) for g in gains]


def _robust_pixels(img: np.ndarray, blurred: np.ndarray, mask: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Píxeles LAB del interior de la prenda (sin el borde mezclado con el fondo ni brillos
    especulares): (difuminados para agrupar, originales para medir), en las mismas posiciones.
    """
    m = (mask > 0).astype(np.uint8)
    h, w = m.shape
    k = max(1, int(round(min(h, w) * 0.012)))
    inner = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
    if inner.sum() > 0.3 * m.sum():
        m = inner
    ys, xs = np.nonzero(m)
    if len(ys) > 40000:
        sel = np.random.default_rng(3).choice(len(ys), 40000, replace=False)
        ys, xs = ys[sel], xs[sel]
    raw = bgr_to_lab_values(img[ys, xs]).astype(np.float64)
    blur = bgr_to_lab_values(blurred[ys, xs]).astype(np.float64)
    specular = (raw[:, 0] > 96) & (np.hypot(raw[:, 1], raw[:, 2]) < 4)
    if specular.mean() < 0.5:  # en una prenda blanca los «brillos» son la propia tela
        raw, blur = raw[~specular], blur[~specular]
    return blur, raw


def measure(img_bgr: np.ndarray, mask: np.ndarray, k: int = 4) -> List[Dict[str, Any]]:
    """
    Colores de la prenda por k-means en (L/2, a, b): agrupa por tono, no por sombra.
    Antes se difumina la foto ~0,6 % de su tamaño, como integra el ojo a un par de metros: el
    jaspeado de un punto o un tweed se ve como un solo color, mientras que rayas y estampados
    (más grandes) se conservan. Sin esto, un jersey verde jaspeado salía «turquesa» o «negro».
    """
    sigma = max(1.0, 0.006 * max(img_bgr.shape[:2]))
    blurred = cv2.GaussianBlur(img_bgr, (0, 0), sigma)
    lab, raw = _robust_pixels(img_bgr, blurred, mask)
    if len(lab) < 20:
        lab = raw = bgr_to_lab_values(img_bgr.reshape(-1, 3)).astype(np.float64)
    k = max(1, min(k, len(lab) // 60 or 1))
    feats = np.column_stack([lab[:, 0] * 0.5, lab[:, 1], lab[:, 2]]).astype(np.float32)
    cv2.setRNGSeed(0)
    _, labels, _ = cv2.kmeans(feats, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    labels = labels.flatten()
    clusters = []
    for i in range(k):
        # Se agrupa con la foto difuminada pero el color se mide con los píxeles originales:
        # así los brillos de una cremallera no aclaran una chaqueta negra
        sel = raw[labels == i]
        if len(sel):
            clusters.append({"lab": np.median(sel, axis=0), "n": len(sel)})
    # Une grupos que el ojo ve como el mismo color (misma tela con luz y sombra)
    merged = True
    while merged and len(clusters) > 1:
        merged = False
        L = np.array([c["lab"] for c in clusters])
        d = ciede2000(L, L) + np.eye(len(L)) * 1e9
        i, j = np.unravel_index(int(d.argmin()), d.shape)
        if d[i, j] < 10:
            a, b = clusters[i], clusters[j]
            n = a["n"] + b["n"]
            clusters[i] = {"lab": (a["lab"] * a["n"] + b["lab"] * b["n"]) / n, "n": n}
            clusters.pop(j)
            merged = True
    total = sum(c["n"] for c in clusters)
    out = []
    for c in sorted(clusters, key=lambda c: -c["n"]):
        L, a, b = (float(v) for v in c["lab"])
        probs = measured_probs(np.array([L, a, b]))
        out.append({"lab": [L, a, b], "hex": lab_to_hex(L, a, b), "share": c["n"] / total, "probs": probs,
                    "name": NAMES[int(np.argmax(probs))]})
    return out


def measured_probs(lab: Sequence[float]) -> np.ndarray:
    """Probabilidad de cada nombre de la paleta según la distancia CIEDE2000 al color medido."""
    d = ciede2000(np.asarray(lab, dtype=np.float64)[None, :], _REF_LAB)[0]
    logits = -(d ** 2) / (2 * SIGMA_DE ** 2)
    p = np.exp(logits - logits.max())
    return p / p.sum()


def fuse(measured: np.ndarray, clip: Optional[Sequence[float]]) -> Tuple[np.ndarray, str]:
    """Combinación logarítmica medida + CLIP. CLIP aporta contexto; la medida ancla el resultado."""
    if clip is None:
        return measured, "medicion_ciede2000"
    c = np.clip(np.asarray(clip, dtype=np.float64), 1e-6, 1)
    logp = (1 - CLIP_WEIGHT) * np.log(np.clip(measured, 1e-9, 1)) + CLIP_WEIGHT * np.log(c)
    p = np.exp(logp - logp.max())
    return p / p.sum(), "medicion_ciede2000+clip"


def masked_crop(img_bgr: np.ndarray, mask: np.ndarray, pad: float = 0.04) -> np.ndarray:
    """Recorte de la prenda con el fondo en gris neutro, para que CLIP mire solo la tela."""
    m = (mask > 0).astype(np.uint8)
    x, y, w, h = cv2.boundingRect(m)
    if w < 10 or h < 10:
        return img_bgr
    px, py = int(w * pad), int(h * pad)
    H, W = m.shape
    x0, y0, x1, y1 = max(0, x - px), max(0, y - py), min(W, x + w + px), min(H, y + h + py)
    crop = img_bgr[y0:y1, x0:x1].copy()
    crop[m[y0:y1, x0:x1] == 0] = (128, 128, 128)
    return crop
