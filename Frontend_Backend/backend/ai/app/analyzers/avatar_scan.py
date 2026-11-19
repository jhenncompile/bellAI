"""
HU-023: avatar 3D a partir del escaneo guiado del teléfono.

Entrada: 5 fotos de la cabeza (frente, izquierda, derecha, arriba, abajo), 1 foto en pose T con el
teléfono apoyado y varias fotos mientras la persona gira sobre sí misma, más su estatura.

1. Escala: la silueta de la pose T (segmentación de MediaPipe Pose) mide la estatura indicada,
   lo que da centímetros por píxel. Alturas de cadera, rodilla, hombro… salen de los puntos del cuerpo.
2. Contornos: en cada foto del giro se mide el ancho del torso (sin brazos, con SegFormer) a las
   mismas alturas y se estima el ángulo de giro con los puntos 3D de MediaPipe (vector entre
   hombros). Para una sección elíptica de semiejes a (lado) y b (frente), el ancho visto con giro θ
   es W = 2·√(a²cos²θ + b²sin²θ): con varios ángulos se ajustan a y b por mínimos cuadrados y se
   calcula el contorno (Ramanujan).
3. Brazos y piernas: grosor medido en la pose T (columnas de la silueta a lo largo del brazo, filas
   en las piernas); largos con los puntos del cuerpo.
4. Cara: los 478 puntos 3D de MediaPipe Face Landmarker en la foto de frente, con la profundidad
   corregida con las vistas girada a izquierda/derecha (y arriba/abajo): un punto girado θ en el eje Y
   se ve en x' = x·cosθ + z·sinθ, de donde sale z. Colores de la propia foto.
5. Malla: avatar_mesh arma cuerpo, cabeza y cara con esas medidas.

Todo es CPU: unas decenas de segundos por escaneo. El teléfono solo hace fotos.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from mediapipe.tasks.python import vision as mpv

from app.analyzers import mp_runtime as mpr
from app.analyzers import avatar_mesh as am
from app.analyzers.body import _run_width, _torso_without_arms

VERSION = "avatar-escaneo-1.1.0"
log = logging.getLogger("bellai.avatar")

NOSE, L_SH, R_SH, L_EL, R_EL, L_WR, R_WR = 0, 11, 12, 13, 14, 15, 16
L_HIP, R_HIP, L_KN, R_KN, L_ANK, R_ANK, L_HEEL, R_HEEL = 23, 24, 25, 26, 27, 28, 29, 30

_TESS = [(c.start, c.end) for c in mpv.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION]
FACE_TRIS = np.array([(_TESS[i][0], _TESS[i + 1][0], _TESS[i + 2][0]) for i in range(0, len(_TESS), 3)], dtype=np.int64)
_OVAL_EDGES = [(c.start, c.end) for c in mpv.FaceLandmarksConnections.FACE_LANDMARKS_FACE_OVAL]
IRIS_L, IRIS_R = 468, 473
EYE_OUT_L, EYE_OUT_R = 33, 263
FOREHEAD, CHIN, NOSE_BRIDGE, CHEEK_L, CHEEK_R = 10, 152, 168, 234, 454
IPD_M = 0.062          # distancia media entre pupilas
EYE_CORNERS_M = 0.092  # distancia media entre las comisuras externas de los ojos


class ScanError(ValueError):
    """Fallo con mensaje para la usuaria y un código para la app."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _oval_order() -> List[int]:
    """Índices del óvalo de la cara en orden (las aristas vienen sueltas)."""
    nxt: Dict[int, int] = {}
    for a, b in _OVAL_EDGES:
        nxt.setdefault(a, b)
    start = _OVAL_EDGES[0][0]
    order, cur = [start], nxt.get(start)
    while cur is not None and cur != start and len(order) < 100:
        order.append(cur)
        cur = nxt.get(cur)
    return order


FACE_OVAL = _oval_order()


# ---------------------------------------------------------------- cuerpo

@dataclass
class BodyFrame:
    img: np.ndarray
    lm: np.ndarray           # (33,2) píxeles
    vis: np.ndarray          # (33,)
    world: np.ndarray        # (33,3) metros, centrado en la cadera
    mask: np.ndarray         # persona (bool)
    top: int
    floor: int
    yaw: float               # radianes; 0 = de frente
    torso: Optional[np.ndarray] = None
    cm_per_px: float = 0.0

    def y_at(self, h_cm: float) -> int:
        return int(round(self.floor - h_cm / self.cm_per_px))

    def h_of(self, y_px: float) -> float:
        return (self.floor - y_px) * self.cm_per_px


def _largest(mask: np.ndarray) -> np.ndarray:
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask.astype(bool)
    best = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return labels == best


def body_frame(img: np.ndarray) -> Optional[BodyFrame]:
    res = mpr.detect_pose(img)
    if not res.pose_landmarks:
        return None
    h, w = img.shape[:2]
    lms = res.pose_landmarks[0]
    lm = mpr.landmarks_px(lms, w, h)
    vis = np.array([getattr(p, "visibility", 1.0) or 0.0 for p in lms], dtype=np.float32)
    world = np.array([[p.x, p.y, p.z] for p in res.pose_world_landmarks[0]], dtype=np.float32) if res.pose_world_landmarks else np.zeros((33, 3))
    if res.segmentation_masks:
        m = res.segmentation_masks[0].numpy_view().squeeze()
        if m.shape != (h, w):
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
        mask = _largest(m > 0.5)
    else:
        seg = mpr.segment(img)
        mask = _largest(seg != mpr.SEG_BACKGROUND)
    rows = np.where(mask.any(axis=1))[0]
    if len(rows) < 20:
        return None
    top = int(rows[0])
    # Suelo: talones y puntas de los pies (la silueta puede incluir la sombra en el suelo)
    feet = float(lm[[L_HEEL, R_HEEL, 31, 32], 1].max())
    floor = int(min(rows[-1], feet + 0.012 * (feet - top)) if rows[-1] > feet else feet)
    # Giro: vector de hombro derecho a izquierdo (y de cadera) en coordenadas 3D de MediaPipe
    v = (world[L_SH] - world[R_SH]) + (world[L_HIP] - world[R_HIP])
    yaw = math.atan2(float(v[2]), float(v[0])) if np.linalg.norm(v[[0, 2]]) > 1e-6 else 0.0
    return BodyFrame(img=img, lm=lm, vis=vis, world=world, mask=mask, top=top, floor=floor, yaw=yaw)


L_FOOT, R_FOOT = 31, 32

BODY_PROBLEMS = {
    "sin_persona": "No te vemos. Ponte de frente al teléfono, a unos dos metros y medio.",
    "cabeza_cortada": "Se te corta la cabeza. Aléjate un paso o inclina el teléfono un poco hacia atrás.",
    "pies_cortados": "No se te ven los pies. Aléjate un paso o apoya el teléfono un poco más abajo.",
    "muy_lejos": "Estás muy lejos. Acércate un paso.",
}


def body_problem(f: Optional[BodyFrame]) -> Optional[str]:
    """Qué impide medir el cuerpo en esta foto (código de BODY_PROBLEMS) o None si se ve entero."""
    if f is None or f.vis[[L_SH, R_SH, L_HIP, R_HIP]].min() < 0.3:
        return "sin_persona"
    h = f.img.shape[0]
    if f.top <= 1 or f.vis[NOSE] < 0.4:
        return "cabeza_cortada"
    feet_y = f.lm[[L_HEEL, R_HEEL, L_FOOT, R_FOOT], 1]
    if f.vis[[L_ANK, R_ANK]].min() < 0.3 or feet_y.max() > h - 2:
        return "pies_cortados"
    if (f.floor - f.top) < 0.35 * h:
        return "muy_lejos"
    return None


def _full_body(f: BodyFrame) -> bool:
    return body_problem(f) is None


def check_body_photo(img: np.ndarray) -> Dict[str, Any]:
    """Comprobación rápida para la app, justo después de la foto en pose T (se repite si falla)."""
    f = body_frame(img)
    code = body_problem(f)
    return {
        "ok": code is None,
        "code": code,
        "message": BODY_PROBLEMS[code] if code else "Te vemos entera.",
        "tpose": bool(f is not None and code is None and _is_tpose(f)),
    }


def _is_tpose(f: BodyFrame) -> bool:
    torso_h = abs(((f.lm[L_HIP, 1] + f.lm[R_HIP, 1]) - (f.lm[L_SH, 1] + f.lm[R_SH, 1])) / 2) or 1
    ok = True
    for sh, wr in ((L_SH, L_WR), (R_SH, R_WR)):
        dy = abs(f.lm[wr, 1] - f.lm[sh, 1])
        dx = abs(f.lm[wr, 0] - f.lm[sh, 0])
        ok &= dy < 0.45 * torso_h and dx > 0.8 * torso_h
    return bool(ok)


def _width(f: BodyFrame, h_cm: float, center_x: float, use_torso: bool) -> Optional[float]:
    y = f.y_at(h_cm)
    if not (0 <= y < f.mask.shape[0]):
        return None
    keep = f.torso[y] if use_torso and f.torso is not None else None
    px = _run_width(f.mask[y], int(round(center_x)), keep)
    return px * f.cm_per_px if px > 0 else None


def _cx(f: BodyFrame) -> float:
    return float((f.lm[L_HIP, 0] + f.lm[R_HIP, 0] + f.lm[L_SH, 0] + f.lm[R_SH, 0]) / 4)


def _band(f: BodyFrame, lo: float, hi: float, pick, use_torso=True, step: float = 0.5) -> Tuple[float, float]:
    """Altura (cm) y ancho de la fila con el ancho máximo/mínimo (`pick`) dentro de [lo, hi]."""
    best: Optional[Tuple[float, float]] = None
    for hcm in np.arange(lo, hi, step):
        w = _width(f, float(hcm), _cx(f), use_torso)
        if w is None:
            continue
        if best is None or pick(w, best[1]):
            best = (float(hcm), w)
    if best is None:
        raise ScanError("silueta", "No pudimos medir tu silueta. Usa ropa ajustada y un fondo despejado.")
    return best


def fit_ellipse(samples: List[Tuple[float, float]], default_ratio: float) -> Tuple[float, float, bool]:
    """
    Semiejes (a lateral, b frontal) a partir de pares (giro θ, ancho W): (W/2)² = a²cos²θ + b²sin²θ.
    Si los giros no cubren al menos ~35° no se puede despejar b y se usa a·default_ratio.
    """
    if not samples:
        raise ValueError("sin muestras")
    th = np.array([s[0] for s in samples])
    w2 = (np.array([s[1] for s in samples]) / 2.0) ** 2
    c2, s2 = np.cos(th) ** 2, np.sin(th) ** 2
    if s2.max() < 0.33:
        a = float(np.sqrt(np.median(w2 / np.maximum(c2, 1e-3))))
        return a, a * default_ratio, False
    A = np.stack([c2, s2], axis=1)
    sol, *_ = np.linalg.lstsq(A, w2, rcond=None)
    a2, b2 = float(sol[0]), float(sol[1])
    if a2 <= 0:
        a2 = float(np.max(w2))
    a = math.sqrt(a2)
    b = math.sqrt(b2) if b2 > 0 else a * default_ratio
    b = min(max(b, 0.5 * a), 1.3 * a)
    return a, b, True


def ellipse_perimeter(a: float, b: float) -> float:
    h = ((a - b) / (a + b)) ** 2
    return math.pi * (a + b) * (1 + 3 * h / (10 + math.sqrt(4 - 3 * h)))


def _limb_thickness(f: BodyFrame, p0: np.ndarray, p1: np.ndarray, t: float, vertical_run: bool) -> Optional[float]:
    """Grosor (cm) de la silueta en el punto p0 + t·(p1 − p0), medido en columna (brazo horizontal) o fila (pierna)."""
    p = p0 + (p1 - p0) * t
    x, y = int(round(p[0])), int(round(p[1]))
    h, w = f.mask.shape
    if not (0 <= x < w and 0 <= y < h):
        return None
    line = f.mask[:, x] if vertical_run else f.mask[y]
    px = _run_width(line, y if vertical_run else x)
    return px * f.cm_per_px if px > 0 else None


def measure_body(tpose: BodyFrame, turns: List[BodyFrame], height_cm: float, warnings: List[str]) -> Dict[str, float]:
    H = height_cm
    for f in [tpose, *turns]:
        f.cm_per_px = H / max(1, f.floor - f.top)
        if f.torso is None:
            f.torso = _torso_without_arms(f.img, f.mask)

    lh = lambda i: tpose.h_of(float(tpose.lm[i, 1]))  # noqa: E731
    hip_h = (lh(L_HIP) + lh(R_HIP)) / 2
    sh_h = (lh(L_SH) + lh(R_SH)) / 2
    knee_h = (lh(L_KN) + lh(R_KN)) / 2
    # Con zapatos de tacón el tobillo sale alto: se limita a lo normal (3,5–6 % de la estatura)
    ankle_h = min(max((lh(L_ANK) + lh(R_ANK)) / 2, 0.035 * H), 0.06 * H)
    if not (0.4 * H < hip_h < 0.62 * H and 0.75 * H < sh_h < 0.9 * H):
        warnings.append("Las alturas del cuerpo salieron fuera de lo normal: revisa que se vea todo el cuerpo y la estatura.")
        hip_h = min(max(hip_h, 0.45 * H), 0.56 * H)
        sh_h = min(max(sh_h, 0.78 * H), 0.86 * H)

    tpose_ok = _is_tpose(tpose)
    if not tpose_ok:
        warnings.append("No detectamos bien la pose T: el grosor de los brazos es aproximado.")

    # Alturas de cada sección, con la pose T (brazos arriba: el torso se ve limpio)
    hip_level, _ = _band(tpose, hip_h - 0.01 * H, hip_h + 0.06 * H, lambda w, b: w > b)
    waist_level, _ = _band(tpose, hip_h + 0.07 * H, sh_h - 0.13 * H, lambda w, b: w < b)
    chest_level, _ = _band(tpose, sh_h - 0.13 * H, sh_h - 0.06 * H, lambda w, b: w > b)
    levels = {
        "hip": hip_level,
        "waist": waist_level,
        "underbust": max(waist_level + 0.03 * H, sh_h - 0.15 * H),
        "chest": chest_level,
        "armpit": sh_h - 0.045 * H,
    }
    depth_ratio = {"hip": 0.78, "waist": 0.72, "underbust": 0.7, "chest": 0.74, "armpit": 0.66}

    frames = [tpose, *turns]
    angles = [abs(math.degrees(f.yaw)) % 180 for f in frames]
    coverage = max((min(a, 180 - a) for a in angles), default=0.0)
    ellipses: Dict[str, Tuple[float, float]] = {}
    fitted_any = False
    for name, hcm in levels.items():
        samples = []
        for f in frames:
            w = _width(f, hcm, _cx(f), use_torso=True)
            if w and 5 < w < 0.4 * H:
                samples.append((f.yaw, w))
        if not samples:
            raise ScanError("silueta", "No pudimos medir tu torso. Usa ropa ajustada y que se vea todo tu cuerpo.")
        a, b, fitted = fit_ellipse(samples, depth_ratio[name])
        fitted_any |= fitted
        ellipses[name] = (a, b)
    if not fitted_any:
        warnings.append("No vimos el giro completo: la profundidad del cuerpo es estimada. Gira más despacio.")

    # Hombros: ancho exterior con la persona de frente y los brazos abajo
    frontal = [f for f in turns if abs(math.cos(f.yaw)) > 0.94]
    shoulder_w = None
    for f in frontal:
        y = int((f.lm[L_SH, 1] + f.lm[R_SH, 1]) / 2 + 0.015 * H / f.cm_per_px)
        if 0 <= y < f.mask.shape[0]:
            px = _run_width(f.mask[y], int(_cx(f)))
            if px > 0:
                shoulder_w = max(shoulder_w or 0, px * f.cm_per_px)
    land_sh = float(np.linalg.norm(tpose.lm[L_SH] - tpose.lm[R_SH])) * tpose.cm_per_px
    if not shoulder_w or not (land_sh * 0.9 < shoulder_w < land_sh * 1.6):
        shoulder_w = land_sh * 1.22

    # Brazos (pose T: columnas de la silueta) y piernas (filas)
    def arm(t0, t1, t, default):
        if not tpose_ok:
            return default
        vals = [_limb_thickness(tpose, tpose.lm[a], tpose.lm[b], t, True) for a, b in ((t0[0], t1[0]), (t0[1], t1[1]))]
        vals = [v for v in vals if v and 2 < v < 0.1 * H]
        return float(np.median(vals)) / 2 if vals else default

    upper_arm_r = arm((L_SH, R_SH), (L_EL, R_EL), 0.55, 0.027 * H)
    elbow_r = arm((L_SH, R_SH), (L_EL, R_EL), 0.98, 0.021 * H)
    forearm_r = arm((L_EL, R_EL), (L_WR, R_WR), 0.35, 0.02 * H)
    wrist_r = arm((L_EL, R_EL), (L_WR, R_WR), 0.9, 0.014 * H)
    upper_arm_len = float(np.mean([np.linalg.norm(tpose.lm[a] - tpose.lm[b]) for a, b in ((L_SH, L_EL), (R_SH, R_EL))])) * tpose.cm_per_px
    forearm_len = float(np.mean([np.linalg.norm(tpose.lm[a] - tpose.lm[b]) for a, b in ((L_EL, L_WR), (R_EL, R_WR))])) * tpose.cm_per_px
    if not (0.13 * H < upper_arm_len < 0.23 * H):
        upper_arm_len = 0.186 * H
    if not (0.11 * H < forearm_len < 0.2 * H):
        forearm_len = 0.146 * H

    def leg(h_cm: float, default: float) -> float:
        vals = []
        for hip, ank in ((L_HIP, L_ANK), (R_HIP, R_ANK)):
            t = (hip_h - h_cm) / max(1e-3, hip_h - ankle_h)
            x = tpose.lm[hip, 0] + (tpose.lm[ank, 0] - tpose.lm[hip, 0]) * t
            w = _width(tpose, h_cm, x, use_torso=False)
            if w:
                vals.append(w)
        vals = [v for v in vals if 3 < v < 0.2 * H]
        if not vals:
            return default
        w = float(np.median(vals))
        hip_a = ellipses["hip"][0]
        # Piernas juntas: un solo tramo con las dos piernas
        if w > 1.3 * hip_a:
            w /= 2
        return w / 2

    crotch_h = hip_h - 0.045 * H
    thigh_r = leg(crotch_h - 0.03 * H, 0.05 * H)
    knee_r = leg(knee_h, 0.032 * H)
    calf_r = leg(knee_h - 0.3 * (knee_h - ankle_h), 0.034 * H)
    ankle_r = leg(ankle_h + 0.015 * H, 0.02 * H)

    # Cuello: la fila más estrecha entre hombros y nariz
    nose_h = lh(NOSE)
    neck_w = None
    for hcm in np.arange(sh_h + 0.01 * H, nose_h - 0.02 * H, 0.4):
        w = _width(tpose, float(hcm), float(tpose.lm[NOSE, 0]), use_torso=False)
        if w and w > 4:
            neck_w = w if neck_w is None else min(neck_w, w)
    neck_r = (neck_w / 2) if neck_w and 3 < neck_w / 2 < 0.05 * H else 0.034 * H
    chin_h = nose_h - 0.045 * H

    thigh_cx = float(abs(tpose.lm[L_HIP, 0] - tpose.lm[R_HIP, 0])) * tpose.cm_per_px / 2
    ankle_cx = float(abs(tpose.lm[L_ANK, 0] - tpose.lm[R_ANK, 0])) * tpose.cm_per_px / 2
    thigh_cx = min(max(thigh_cx, thigh_r * 0.9), ellipses["hip"][0] - thigh_r * 0.5)
    ankle_cx = min(max(ankle_cx, 4.5), 14.0)

    cm = lambda v: v / 100.0  # noqa: E731
    m = {
        "height": cm(H), "crotch_h": cm(crotch_h), "hip_h": cm(levels["hip"]), "waist_h": cm(levels["waist"]),
        "underbust_h": cm(levels["underbust"]), "chest_h": cm(levels["chest"]), "armpit_h": cm(levels["armpit"]),
        "shoulder_h": cm(sh_h), "knee_h": cm(knee_h), "ankle_h": cm(ankle_h), "chin_h": cm(chin_h),
        "shoulder_half": cm(shoulder_w / 2), "neck_r": cm(neck_r),
        "thigh_r": cm(thigh_r), "knee_r": cm(knee_r), "calf_r": cm(calf_r), "ankle_r": cm(ankle_r),
        "thigh_cx": cm(thigh_cx), "ankle_cx": cm(ankle_cx),
        "upper_arm_r": cm(upper_arm_r), "elbow_r": cm(elbow_r), "forearm_r": cm(forearm_r), "wrist_r": cm(wrist_r),
        "upper_arm_len": cm(upper_arm_len), "forearm_len": cm(forearm_len),
        "hand_len": cm(0.108 * H), "foot_len": cm(0.152 * H),
        "angle_coverage_deg": coverage,
    }
    for name, (a, b) in ellipses.items():
        m[f"{name}_a"], m[f"{name}_b"] = cm(a), cm(b)
    # La pelvis no puede ser más estrecha que las dos piernas juntas
    m["hip_a"] = max(m["hip_a"], m["thigh_cx"] + m["thigh_r"])
    return m


# ---------------------------------------------------------------- cara

def _face_points(img: np.ndarray) -> Optional[np.ndarray]:
    res = mpr.detect_faces(img)
    if not res.face_landmarks:
        return None
    h, w = img.shape[:2]
    faces = res.face_landmarks
    # La cara más grande (la de la usuaria, no alguien al fondo)
    best = max(faces, key=lambda f: (max(p.x for p in f) - min(p.x for p in f)))
    return np.array([[p.x * w, p.y * h, p.z * w] for p in best], dtype=np.float64)


def _align(view: np.ndarray, ref: np.ndarray) -> np.ndarray:
    """Centra en el entrecejo y escala con el alto de la cara (frente-barbilla), que no cambia al girar."""
    v = view - view[NOSE_BRIDGE]
    s = np.linalg.norm(ref[FOREHEAD, :2] - ref[CHIN, :2]) / max(1e-6, np.linalg.norm(view[FOREHEAD, :2] - view[CHIN, :2]))
    return v * s


def _refine_depth(front: np.ndarray, views: Dict[str, np.ndarray], warnings: List[str]) -> Tuple[np.ndarray, List[str]]:
    """Corrige la profundidad (z) de la cara con las vistas giradas. Devuelve z y las vistas usadas."""
    F = front - front[NOSE_BRIDGE]
    X, Y, Z = F[:, 0], -F[:, 1], -F[:, 2]  # Y hacia arriba, Z hacia la cámara
    half_w = max(1e-6, abs(F[CHEEK_R, 0] - F[CHEEK_L, 0]) / 2)
    num, den = Z.copy(), np.ones_like(Z)
    used: List[str] = []
    grid = np.radians(np.arange(-75, 76, 1.0))
    for name, pts in views.items():
        S = _align(pts, front)
        Sx, Sy = S[:, 0], -S[:, 1]
        if name in ("izquierda", "derecha"):
            errs = [np.mean((Sx - (X * math.cos(t) + Z * math.sin(t))) ** 2) for t in grid]
            th = float(grid[int(np.argmin(errs))])
            if abs(math.sin(th)) < 0.26:
                warnings.append(f"En la foto girando a la {name} casi no giraste la cabeza.")
                continue
            z_est = (Sx - X * math.cos(th)) / math.sin(th)
            w = np.clip(0.5 - 0.5 * np.sign(th) * X / half_w, 0, 1)
        else:
            errs = [np.mean((Sy - (Y * math.cos(t) - Z * math.sin(t))) ** 2) for t in grid]
            ph = float(grid[int(np.argmin(errs))])
            if abs(math.sin(ph)) < 0.2:
                continue
            z_est = (Y * math.cos(ph) - Sy) / math.sin(ph)
            w = np.clip(0.5 + 0.5 * np.sign(ph) * Y / (half_w * 1.3), 0, 1) * 0.6
        rms = math.sqrt(float(np.min(errs))) / half_w
        if rms > 0.12:
            warnings.append(f"La foto de la cabeza ({name}) no coincidió bien con la de frente; no se usó.")
            continue
        num += w * z_est
        den += w
        used.append(name)
    z = num / den
    return np.clip(z, Z - 0.3 * half_w, Z + 0.3 * half_w), used


def _sample_colors(img: np.ndarray, px: np.ndarray) -> np.ndarray:
    blur = cv2.medianBlur(img, 5)
    h, w = img.shape[:2]
    xs = np.clip(np.round(px[:, 0]).astype(int), 0, w - 1)
    ys = np.clip(np.round(px[:, 1]).astype(int), 0, h - 1)
    return blur[ys, xs][:, ::-1].astype(np.float64)  # BGR → RGB


def _median_rgb(img: np.ndarray, mask: np.ndarray) -> Optional[np.ndarray]:
    if mask.sum() < 200:
        return None
    return np.median(img[mask], axis=0)[::-1].astype(np.float64)


def measure_face(front_img: np.ndarray, views: Dict[str, np.ndarray], warnings: List[str]) -> Dict[str, Any]:
    pts = _face_points(front_img)
    if pts is None:
        raise ScanError("sin_rostro", "No vimos tu cara en la foto de frente. Repite el escaneo con buena luz y mirando al teléfono.")
    view_pts = {}
    for name, img in views.items():
        p = _face_points(img)
        if p is None:
            warnings.append(f"No vimos tu cara en la foto de la cabeza ({name}).")
        else:
            view_pts[name] = p
    z, used = _refine_depth(pts, view_pts, warnings)

    # Escala a metros con la distancia entre pupilas (o entre comisuras de los ojos)
    if len(pts) > IRIS_R:
        s = IPD_M / max(1e-6, np.linalg.norm(pts[IRIS_L, :2] - pts[IRIS_R, :2]))
    else:
        s = EYE_CORNERS_M / max(1e-6, np.linalg.norm(pts[EYE_OUT_L, :2] - pts[EYE_OUT_R, :2]))
    o = pts[NOSE_BRIDGE]
    P = np.stack([(pts[:, 0] - o[0]) * s, -(pts[:, 1] - o[1]) * s, z * s], axis=1)
    P = P[:468]  # sin los puntos del iris (no tienen triángulos)

    # Casco de la cabeza ajustado al óvalo de la cara
    oval = P[FACE_OVAL]
    face_h = P[FOREHEAD, 1] - P[CHIN, 1]
    top = P[FOREHEAD, 1] + 0.45 * face_h  # coronilla: el punto 10 está en la frente, no arriba del cráneo
    bottom = P[CHIN, 1] - 0.02 * face_h
    cy = (top + bottom) / 2
    ay = (top - bottom) / 2
    ax = float(np.max(np.abs(oval[:, 0]))) * 1.1
    r2 = (oval[:, 0] / ax) ** 2 + ((oval[:, 1] - cy) / ay) ** 2
    if r2.max() >= 0.97:
        k = math.sqrt(r2.max() / 0.97)
        ax, ay = ax * k, ay * k
        r2 = (oval[:, 0] / ax) ** 2 + ((oval[:, 1] - cy) / ay) ** 2
    sroot = np.sqrt(np.clip(1 - r2, 0, 1))
    A = np.stack([np.ones_like(sroot), sroot], axis=1)
    (cz, az), *_ = np.linalg.lstsq(A, oval[:, 2], rcond=None)
    az = float(min(max(az, 0.95 * ax), 1.4 * ax))
    cz = float(np.mean(oval[:, 2] - az * sroot))
    # Origen en el centro de la cabeza
    P = P - np.array([0.0, 0.0, cz])
    oval = P[FACE_OVAL]

    # Colores: la cara de la foto; piel y cabello de la segmentación
    colors = _sample_colors(front_img, pts[:468])
    seg = mpr.segment(front_img)
    skin = _median_rgb(front_img, seg == mpr.SEG_FACE_SKIN)
    hair_mask = seg == mpr.SEG_HAIR
    hair = _median_rgb(front_img, hair_mask)
    face_px_h = abs(pts[CHIN, 1] - pts[FOREHEAD, 1])
    has_hair = bool(hair is not None and hair_mask.sum() > 0.15 * face_px_h ** 2)
    if skin is None:
        skin = np.median(colors[[CHEEK_L, CHEEK_R, 50, 280]], axis=0)
    # Línea del pelo: la fila más baja con cabello encima de la frente, en el centro de la cara
    hairline_y = P[FOREHEAD, 1] + 0.05 * face_h
    if has_hair:
        cx = int(round(pts[FOREHEAD, 0]))
        col = hair_mask[: int(pts[FOREHEAD, 1]) + 1, max(0, cx - 3): cx + 4].any(axis=1)
        rows = np.where(col)[0]
        if len(rows):
            gap_px = pts[FOREHEAD, 1] - rows[-1]
            hairline_y = P[FOREHEAD, 1] + max(0.0, gap_px) * s

    eye_hex = "#5D4037"
    if len(pts) > IRIS_R:
        iris_colors = _sample_colors(front_img, pts[[IRIS_L, IRIS_R]])
        eye_hex = _hex(np.mean(iris_colors, axis=0))

    return {
        "points": P,
        "tris": FACE_TRIS,
        "colors": colors,
        "oval": oval,
        "head": {"ax": ax, "ay": ay, "az": az, "cy": cy},
        "hairline_y": float(min(hairline_y, top - 0.02)),
        "has_hair": has_hair,
        "skin_rgb": skin,
        "hair_rgb": hair if hair is not None else np.array([59, 42, 32], float),
        "eye_hex": eye_hex,
        "views_used": used,
        "head_height_m": float(top - P[CHIN, 1]),
    }


def hair_end_height(tpose: BodyFrame) -> Optional[float]:
    """Altura (cm) donde termina el cabello en la pose T, para la melena de la espalda."""
    seg = mpr.segment(tpose.img)
    hair = (seg == mpr.SEG_HAIR) & tpose.mask
    rows = np.where(hair.any(axis=1))[0]
    if len(rows) < 3:
        return None
    return tpose.h_of(float(rows[-1]))


def _hex(rgb: np.ndarray) -> str:
    r, g, b = (int(max(0, min(255, round(v)))) for v in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


# ---------------------------------------------------------------- todo junto

def reconstruct(face_imgs: Dict[str, np.ndarray], tpose_img: np.ndarray, turn_imgs: List[np.ndarray],
                height_cm: float) -> Dict[str, Any]:
    if not (120 <= height_cm <= 220):
        raise ScanError("estatura", "Indica tu estatura en centímetros (entre 120 y 220).")
    if "frente" not in face_imgs:
        raise ScanError("sin_rostro", "Falta la foto de la cara de frente.")
    warnings: List[str] = []

    tpose = body_frame(tpose_img)
    problem = body_problem(tpose)
    turns: List[BodyFrame] = []
    turn_problems: List[str] = []
    for img in turn_imgs:
        f = body_frame(img)
        p = body_problem(f)
        if p is None:
            turns.append(f)
        else:
            turn_problems.append(p)
    if problem:
        h, w = tpose_img.shape[:2]
        log.warning("Pose T no válida (%s): imagen %dx%d, %s", problem, w, h,
                    "sin pose" if tpose is None else f"silueta {tpose.top}-{tpose.floor}, visib. nariz {tpose.vis[NOSE]:.2f} tobillos {tpose.vis[[L_ANK, R_ANK]].round(2).tolist()}")
        # Respaldo: la foto del giro más de frente en la que sí se ve entera
        frontal = sorted(turns, key=lambda f: -abs(math.cos(f.yaw)))
        if frontal and abs(math.cos(frontal[0].yaw)) > 0.9:
            tpose = frontal[0]
            warnings.append("La foto en pose T no sirvió; usamos una del giro y el grosor de los brazos es aproximado.")
        else:
            raise ScanError(problem if problem != "sin_persona" else "cuerpo_incompleto", BODY_PROBLEMS[problem])
    if turn_problems:
        log.info("Fotos del giro descartadas: %s", {p: turn_problems.count(p) for p in set(turn_problems)})
    if len(turn_imgs) and len(turns) < 3:
        warnings.append("Casi no te vimos al girar: la profundidad del cuerpo es estimada.")

    body = measure_body(tpose, turns, height_cm, warnings)
    face = measure_face(face_imgs["frente"], {k: v for k, v in face_imgs.items() if k != "frente"}, warnings)
    hair_end = hair_end_height(tpose)

    # La barbilla del cuerpo se alinea con la altura de la cabeza medida en la cara
    body["chin_h"] = min(body["chin_h"], body["height"] - face["head_height_m"] * 0.98)
    body["chin_h"] = max(body["chin_h"], body["shoulder_h"] + 0.05)
    # El punto del hombro de MediaPipe a veces cae bajo (ropa holgada): el cuello visible no pasa del 5 % de la estatura
    neck_max = 0.05 * body["height"]
    if body["chin_h"] - body["shoulder_h"] > neck_max:
        body["shoulder_h"] = body["chin_h"] - neck_max
        body["armpit_h"] = max(body["armpit_h"], body["shoulder_h"] - 0.045 * body["height"])

    skin = face["skin_rgb"]
    hair = face["hair_rgb"]

    def cm(v: float) -> float:
        return round(v * 100, 1)

    perim = lambda n: cm(ellipse_perimeter(body[f"{n}_a"], body[f"{n}_b"]))  # noqa: E731
    hair_len = "Corto"
    if face["has_hair"] and hair_end is not None:
        if hair_end < body["shoulder_h"] * 100 - 3:
            hair_len = "Largo"
        elif hair_end < body["chin_h"] * 100 - 2:
            hair_len = "Medio"
    measurements = {
        "estaturaCm": round(height_cm, 1),
        "pechoCm": perim("chest"),
        "bajoBustoCm": perim("underbust"),
        "cinturaCm": perim("waist"),
        "caderaCm": perim("hip"),
        "anchoHombrosCm": cm(body["shoulder_half"] * 2),
        "largoBrazoCm": cm(body["upper_arm_len"] + body["forearm_len"]),
        "entrepiernaCm": cm(body["crotch_h"]),
        "musloCm": cm(2 * math.pi * body["thigh_r"]),
        "cuelloCm": cm(2 * math.pi * body["neck_r"]),
    }

    # El escaneo ajusta el maniquí (MakeHuman CC0): silueta base y ajustes salen de las medidas
    from app.analyzers import mannequin
    sh_ratio = round(body["shoulder_half"] / max(0.01, body["hip_a"]), 2)
    waist_ratio = round(body["waist_a"] / max(0.01, body["hip_a"]), 2)
    fit = mannequin.fit_from_measurements(measurements)
    mesh = mannequin.build_mesh({**fit, "hairHex": _hex(hair)})
    levels = mesh.get("levels") or {k: round(body[k], 4) for k in ("height", "chin_h", "shoulder_h", "chest_h", "waist_h", "hip_h", "crotch_h", "knee_h", "ankle_h")}
    return {
        "version": VERSION,
        "units": "m",
        "mesh": {**mesh, "levels": levels},
        "measurements": measurements,
        "proportions": {
            "shoulder": sh_ratio,
            "waist": waist_ratio,
            "hip": 1.0,
            "legToBody": round(body["crotch_h"] / max(0.01, body["height"]), 2),
        },
        "appearance": {"skinHex": _hex(skin), "hairHex": _hex(hair), "hairLength": hair_len},
        # Lo que la app guarda como personalización del maniquí (la usuaria puede cambiarlo después)
        "mannequin": {k: v for k, v in fit.items() if k != "heightCm"},
        "quality": {
            "turnFramesUsed": len(turns),
            "turnFramesReceived": len(turn_imgs),
            "angleCoverageDeg": round(body["angle_coverage_deg"], 0),
            "headViewsUsed": face["views_used"],
            "vertices": len(mesh["positions"]) // 3,
            "triangles": len(mesh["indices"]) // 3,
            "warnings": warnings,
        },
    }
