"""
HU-023: malla 3D del avatar a partir de medidas reales (metros).

Ejes: Y hacia arriba con el suelo en y=0, Z hacia delante (la persona mira a +Z), X a su izquierda.
Solo numpy: el cuerpo se arma con secciones elípticas medidas (torso, piernas, brazos), la cabeza
con un casco elipsoidal ajustado al óvalo de la cara y la cara con la malla de 468 puntos de
MediaPipe, coloreada con la foto. Cada vértice lleva una región para que la app vista el avatar
pintando las zonas que cubre cada prenda.
"""
from __future__ import annotations

import math
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

REGIONS: Dict[str, int] = {
    "cabeza": 0, "rostro": 1, "cabello": 2, "cuello": 3, "torso": 4, "pelvis": 5,
    "brazo": 6, "antebrazo": 7, "mano": 8, "muslo": 9, "pierna": 10, "pie": 11,
}


class MeshBuilder:
    """Acumula piezas (vértices, color, región y triángulos) en una sola malla indexada."""

    def __init__(self) -> None:
        self._pos: List[np.ndarray] = []
        self._col: List[np.ndarray] = []
        self._reg: List[np.ndarray] = []
        self._tri: List[np.ndarray] = []
        self.count = 0

    def add(self, pts: np.ndarray, color, region, tris: np.ndarray) -> int:
        pts = np.asarray(pts, dtype=np.float64).reshape(-1, 3)
        n = len(pts)
        col = np.asarray(color, dtype=np.float64)
        col = np.broadcast_to(col, (n, 3)) if col.ndim == 1 else col.reshape(n, 3)
        reg = np.broadcast_to(np.asarray(region, dtype=np.int64), (n,))
        base = self.count
        self._pos.append(pts)
        self._col.append(np.clip(col, 0, 255))
        self._reg.append(reg.copy())
        if len(tris):
            self._tri.append(np.asarray(tris, dtype=np.int64).reshape(-1, 3) + base)
        self.count += n
        return base

    def arrays(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        pos = np.concatenate(self._pos) if self._pos else np.zeros((0, 3))
        col = np.concatenate(self._col) if self._col else np.zeros((0, 3))
        reg = np.concatenate(self._reg) if self._reg else np.zeros((0,), dtype=np.int64)
        tri = np.concatenate(self._tri) if self._tri else np.zeros((0, 3), dtype=np.int64)
        return pos, col, reg, tri

    def to_json(self) -> Dict[str, list]:
        pos, col, reg, tri = self.arrays()
        return {
            "positions": [round(float(v), 4) for v in pos.reshape(-1)],
            "colors": [int(round(v)) for v in col.reshape(-1)],
            "regions": [int(v) for v in reg],
            "indices": [int(v) for v in tri.reshape(-1)],
        }


def _frame(axis: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Base ortonormal (lado, frente) perpendicular a `axis`, con el frente lo más cerca posible de +Z."""
    d = axis / (np.linalg.norm(axis) or 1.0)
    side = np.cross(d, np.array([0.0, 0.0, 1.0]))
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1.0, 0.0, 0.0])
    side /= np.linalg.norm(side)
    front = np.cross(side, d)
    return side, front


def loft(mb: MeshBuilder, centers: Sequence[Sequence[float]], radii: Sequence[Tuple[float, float]], color, region,
         seg: int = 32, cap_start: bool = True, cap_end: bool = True,
         offsets: Optional[Sequence[Tuple[float, float]]] = None, arc: Optional[Tuple[float, float]] = None) -> None:
    """
    Tubo por secciones elípticas: `centers` es el eje (K,3) y `radii` los semiejes (lateral, frontal)
    de cada sección. `arc` (de, a) en radianes deja el tubo abierto (p. ej. el cabello de la espalda).
    `region` puede ser un número o una lista por sección.
    """
    c = np.asarray(centers, dtype=np.float64)
    k = len(c)
    closed = arc is None
    phis = np.linspace(0, 2 * math.pi, seg, endpoint=False) if closed else np.linspace(arc[0], arc[1], seg)
    pts, regs = [], []
    reg_list = list(region) if isinstance(region, (list, tuple, np.ndarray)) else [region] * k
    for i in range(k):
        axis = c[min(i + 1, k - 1)] - c[max(i - 1, 0)]
        side, front = _frame(axis)
        a, b = radii[i]
        ox, oz = offsets[i] if offsets is not None else (0.0, 0.0)
        for p in phis:
            pts.append(c[i] + side * (a * math.cos(p) + ox) + front * (b * math.sin(p) + oz))
            regs.append(reg_list[i])
    tris = []
    cols = seg if closed else seg - 1
    for i in range(k - 1):
        for j in range(cols):
            i0, i1 = i * seg + j, i * seg + (j + 1) % seg
            i2, i3 = (i + 1) * seg + j, (i + 1) * seg + (j + 1) % seg
            tris += [(i0, i2, i1), (i1, i2, i3)]
    pts_arr = np.array(pts)
    extra_regs = []
    if closed and cap_start:
        pts_arr = np.vstack([pts_arr, c[0] + _offset_center(c, 0, offsets)])
        ci = len(pts_arr) - 1
        tris += [(ci, j, (j + 1) % seg) for j in range(seg)]
        extra_regs.append(reg_list[0])
    if closed and cap_end:
        pts_arr = np.vstack([pts_arr, c[-1] + _offset_center(c, k - 1, offsets)])
        ci = len(pts_arr) - 1
        base = (k - 1) * seg
        tris += [(ci, base + (j + 1) % seg, base + j) for j in range(seg)]
        extra_regs.append(reg_list[-1])
    mb.add(pts_arr, color, np.array(regs + extra_regs), np.array(tris))


def _offset_center(c: np.ndarray, i: int, offsets) -> np.ndarray:
    if offsets is None:
        return np.zeros(3)
    axis = c[min(i + 1, len(c) - 1)] - c[max(i - 1, 0)]
    side, front = _frame(axis)
    return side * offsets[i][0] + front * offsets[i][1]


def ellipsoid(center, axes, rows: int = 14, cols: int = 20, rot_z: float = 0.0) -> Tuple[np.ndarray, np.ndarray]:
    """Vértices y triángulos de un elipsoide (con polos), girado `rot_z` alrededor de Z."""
    cx, cy, cz = center
    ax, ay, az = axes
    pts = [(0.0, ay, 0.0)]
    for r in range(1, rows):
        t = math.pi * r / rows
        for k in range(cols):
            p = 2 * math.pi * k / cols
            pts.append((ax * math.sin(t) * math.cos(p), ay * math.cos(t), az * math.sin(t) * math.sin(p)))
    pts.append((0.0, -ay, 0.0))
    v = np.array(pts)
    if rot_z:
        cr, sr = math.cos(rot_z), math.sin(rot_z)
        v = v @ np.array([[cr, sr, 0], [-sr, cr, 0], [0, 0, 1]])
    v += np.array([cx, cy, cz])
    tris = []
    for k in range(cols):
        tris.append((0, 1 + (k + 1) % cols, 1 + k))
    for r in range(rows - 2):
        for k in range(cols):
            a = 1 + r * cols + k
            b = 1 + r * cols + (k + 1) % cols
            c_ = a + cols
            d = b + cols
            tris += [(a, d, c_), (a, b, d)]
    last = len(v) - 1
    base = 1 + (rows - 2) * cols
    for k in range(cols):
        tris.append((last, base + k, base + (k + 1) % cols))
    return v, np.array(tris)


def _densify(levels: Sequence[Tuple[float, float, float]], per_segment: int = 3) -> List[Tuple[float, float, float]]:
    """Interpola secciones intermedias (altura, a, b) con una curva suave entre las medidas."""
    out: List[Tuple[float, float, float]] = []
    for i in range(len(levels) - 1):
        y0, a0, b0 = levels[i]
        y1, a1, b1 = levels[i + 1]
        for s in range(per_segment):
            t = s / per_segment
            w = t * t * (3 - 2 * t)  # suavizado (smoothstep): sin esquinas entre medidas
            out.append((y0 + (y1 - y0) * t, a0 + (a1 - a0) * w, b0 + (b1 - b0) * w))
    out.append(levels[-1])
    return out


def build_body(mb: MeshBuilder, m: Dict[str, float], skin) -> None:
    """Torso, piernas, pies, brazos, manos y cuello con las medidas de `m` (metros)."""
    torso_levels = [
        (m["crotch_h"], m["hip_a"] * 0.62, m["hip_b"] * 0.7),
        (m["hip_h"], m["hip_a"], m["hip_b"]),
        ((m["hip_h"] + m["waist_h"]) / 2, (m["hip_a"] + m["waist_a"]) / 2, (m["hip_b"] + m["waist_b"]) / 2),
        (m["waist_h"], m["waist_a"], m["waist_b"]),
        (m["underbust_h"], m["underbust_a"], m["underbust_b"]),
        (m["chest_h"], m["chest_a"], m["chest_b"]),
        (m["armpit_h"], m["armpit_a"], m["armpit_b"]),
        (m["shoulder_h"] - 0.015, m["shoulder_half"] * 0.95, m["armpit_b"] * 0.82),
        # Hombros redondeados: la articulación queda ~3 cm por debajo de la superficie
        (m["shoulder_h"] + 0.022, m["shoulder_half"] * 0.72, m["armpit_b"] * 0.62),
        (m["shoulder_h"] + 0.045, m["neck_r"] * 2.1, m["neck_r"] * 1.45),  # trapecio
        (m["shoulder_h"] + 0.055, m["neck_r"] * 1.05, m["neck_r"]),
    ]
    rings = _densify(torso_levels, 3)
    regions = [REGIONS["pelvis"] if y < m["waist_h"] else REGIONS["torso"] for y, _, _ in rings]
    # Glúteos un poco atrás y pecho un poco adelante: las secciones no son concéntricas
    offsets = []
    for y, _, b in rings:
        if y < m["waist_h"]:
            offsets.append((0.0, -0.08 * b * _bump(y, m["crotch_h"], m["waist_h"])))
        else:
            offsets.append((0.0, 0.06 * b * _bump(y, m["waist_h"], m["armpit_h"])))
    loft(mb, [(0, y, 0) for y, _, _ in rings], [(a, b) for _, a, b in rings], skin, regions, seg=36, offsets=offsets)

    # Cuello
    neck_top = m["chin_h"] + 0.06  # termina dentro de la cabeza: sin hueco bajo la barbilla
    loft(mb, [(0, m["shoulder_h"] - 0.01, -0.005), (0, neck_top, 0.0)], [(m["neck_r"], m["neck_r"] * 0.92)] * 2,
         skin, REGIONS["cuello"], seg=20, cap_start=False, cap_end=False)

    # Piernas y pies
    for side in (-1, 1):
        # La pierna arranca dentro de la cadera con su ancho, para que la pelvis no acabe en «falda»
        top = m["hip_h"] - 0.01
        hip_leg = max(m["thigh_r"], m["hip_a"] - m["thigh_cx"])
        knee, ankle = m["knee_h"], m["ankle_h"]
        calf = knee - 0.3 * (knee - ankle)
        thigh = m["crotch_h"] - 0.02
        heights = [top, thigh, (thigh + knee) / 2, knee, calf, ankle + 0.01, ankle * 0.75]
        rad = [(hip_leg, m["hip_b"] * 0.78), (m["thigh_r"], m["thigh_r"] * 0.97), (m["thigh_r"] * 0.86, m["thigh_r"] * 0.84),
               (m["knee_r"], m["knee_r"] * 0.95), (m["calf_r"], m["calf_r"] * 0.98), (m["ankle_r"], m["ankle_r"]), (m["ankle_r"], m["ankle_r"])]
        xs = np.interp(heights, [ankle, thigh], [m["ankle_cx"], m["thigh_cx"]])
        xs[0] = m["thigh_cx"]
        regs = [REGIONS["pelvis"], REGIONS["muslo"], REGIONS["muslo"], REGIONS["pierna"], REGIONS["pierna"], REGIONS["pierna"], REGIONS["pierna"]]
        loft(mb, [(side * x, h, 0) for x, h in zip(xs, heights)], rad, skin, regs, seg=22)
        fl = m["foot_len"]
        v, t = ellipsoid((side * m["ankle_cx"], m["ankle_h"] * 0.38, fl * 0.22), (fl * 0.19, m["ankle_h"] * 0.42, fl * 0.5), 8, 16)
        mb.add(v, skin, REGIONS["pie"], t)

    # Brazos relajados (10° separados del cuerpo) y manos
    ang = math.radians(10)
    for side in (-1, 1):
        d = np.array([side * math.sin(ang), -math.cos(ang), 0.0])
        s = np.array([side * (m["shoulder_half"] - m["upper_arm_r"] * 0.85), m["shoulder_h"] - m["upper_arm_r"] * 0.9, 0.0])
        ua, fa = m["upper_arm_len"], m["forearm_len"]
        ts = [0.0, ua * 0.5, ua, ua + fa * 0.4, ua + fa]
        rad = [m["upper_arm_r"] * 1.08, m["upper_arm_r"], m["elbow_r"], m["forearm_r"], m["wrist_r"]]
        regs = [REGIONS["brazo"], REGIONS["brazo"], REGIONS["antebrazo"], REGIONS["antebrazo"], REGIONS["antebrazo"]]
        loft(mb, [s + d * t for t in ts], [(r, r * 0.92) for r in rad], skin, regs, seg=16)
        hl = m["hand_len"]
        v, t = ellipsoid(s + d * (ua + fa + hl * 0.45), (m["wrist_r"] * 1.25, hl * 0.5, m["wrist_r"] * 0.6), 8, 14, rot_z=side * ang)
        mb.add(v, skin, REGIONS["mano"], t)


def _bump(y: float, y0: float, y1: float) -> float:
    """0 en los extremos, 1 en el centro del tramo [y0, y1]."""
    if y1 <= y0:
        return 0.0
    t = min(max((y - y0) / (y1 - y0), 0.0), 1.0)
    return math.sin(math.pi * t)


def build_head(mb: MeshBuilder, face: Optional[Dict], m: Dict[str, float], skin, hair, hair_end_h: Optional[float]) -> None:
    """
    Cabeza: casco elipsoidal ajustado al óvalo de la cara y, delante, la malla de la cara
    (coordenadas en metros con origen en el centro de la cabeza). Sin cara, solo el casco.
    """
    top = m["height"]
    if face is None:
        ay = (top - m["chin_h"]) / 2
        cy = top - ay
        ax = ay * 0.78
        v, t = ellipsoid((0, cy, 0.0), (ax, ay, ax * 1.15), 18, 28)
        reg = np.where(v[:, 1] > cy + ay * 0.15, REGIONS["cabello"], REGIONS["cabeza"])
        col = np.where(reg[:, None] == REGIONS["cabello"], np.asarray(hair, float), np.asarray(skin, float))
        mb.add(v, col, reg, t)
        _hair_back(mb, (0, cy, 0.0), ax, ax * 1.15, ay, hair, hair_end_h, m)
        return

    pts = face["points"].copy()        # (N,3) metros, origen en el centro de la cabeza
    head = face["head"]                # ax, ay, az, cy (centro respecto al origen)
    shift = np.array([0.0, top - (head["cy"] + head["ay"]), 0.0])
    pts += shift
    center = np.array([0.0, head["cy"], 0.0]) + shift
    v, t = ellipsoid(tuple(center), (head["ax"], head["ay"], head["az"]), 28, 40)

    # Hueco del casco donde va la cara (dentro del óvalo y en la mitad delantera)
    oval = (face["oval"] + shift)[:, :2]
    poly = np.round(oval * 10000).astype(np.int32).reshape(-1, 1, 2)
    inside = np.array([
        p[2] > center[2] and cv2.pointPolygonTest(poly, (float(p[0] * 10000), float(p[1] * 10000)), False) >= 0
        for p in v
    ])
    # Solo se quitan los triángulos del todo dentro de la cara: el borde del casco queda tras la cara, sin rendija
    keep_tri = ~inside[t].all(axis=1)
    hair_line = face["hairline_y"] + shift[1]
    is_hair = (v[:, 1] > hair_line) | ((v[:, 2] < center[2] - head["az"] * 0.15) & (v[:, 1] > center[1] - head["ay"] * 0.45))
    if not face.get("has_hair", True):
        is_hair[:] = False
    reg = np.where(is_hair, REGIONS["cabello"], REGIONS["cabeza"])
    col = np.where(is_hair[:, None], np.asarray(hair, float), np.asarray(skin, float))
    mb.add(v, col, reg, t[keep_tri])

    mb.add(pts, face["colors"], REGIONS["rostro"], face["tris"])
    if face.get("has_hair", True):
        _hair_back(mb, tuple(center), head["ax"], head["az"], head["ay"], hair, hair_end_h, m)


def _hair_back(mb: MeshBuilder, center, ax: float, az: float, ay: float, hair, hair_end_h: Optional[float], m: Dict[str, float]) -> None:
    """Melena por detrás de la cabeza hasta donde llega el cabello (si pasa de la nuca)."""
    if hair_end_h is None:
        return
    start = center[1] - ay * 0.1
    end = max(min(hair_end_h, start - 0.03), m["shoulder_h"] - 0.25)
    if end >= center[1] - ay * 0.55:
        return  # cabello corto: lo cubre el casco
    ys = np.linspace(start, end, 6)
    radii = [(ax * (1.04 + 0.05 * i / 5), az * (1.02 + 0.08 * i / 5)) for i in range(6)]
    loft(mb, [(center[0], y, center[2] - 0.01) for y in ys], radii, hair, REGIONS["cabello"],
         seg=14, arc=(math.radians(195), math.radians(345)))
