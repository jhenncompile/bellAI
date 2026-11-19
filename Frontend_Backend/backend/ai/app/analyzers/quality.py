"""HU-035: validación de condiciones de la fotografía antes de cualquier análisis.

Comprueba resolución, iluminación, contraste y nitidez para todo tipo de foto y, según el tipo:
- rostro: un único rostro, distancia (tamaño relativo), orientación (yaw/roll) y luz uniforme.
- cuerpo: cuerpo completo visible, distancia, de frente, brazos separados del torso.
- prenda: solo las comprobaciones generales.
Los umbrales son configurables (el backend los envía desde platform_settings).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from app.analyzers import mp_runtime as mpr

VERSION = "quality-1.0.0"

DEFAULT_THRESHOLDS: Dict[str, float] = {
    "min_short_side_px": 480,
    "min_brightness": 70,        # media de gris 0-255
    "max_brightness": 210,
    "max_clipped_ratio": 0.12,   # fracción de píxeles quemados (>250)
    "min_contrast_std": 28,
    "min_sharpness": 45,         # varianza del laplaciano a 512 px
    "face_min_width_ratio": 0.22,
    "face_max_width_ratio": 0.80,
    "face_max_yaw": 0.12,        # desplazamiento de la nariz respecto al centro (0-0.5)
    "face_max_roll_deg": 12,
    "face_max_side_light_diff": 28,  # diferencia de L entre mejillas
    "body_min_height_ratio": 0.55,
    "body_max_height_ratio": 0.98,
    "body_min_visibility": 0.5,
    "body_max_shoulder_tilt_deg": 8,
}


@dataclass
class Check:
    code: str
    ok: bool
    message: str
    value: Optional[float] = None
    threshold: Optional[float] = None

    def as_dict(self) -> Dict[str, Any]:
        d = {"code": self.code, "ok": bool(self.ok), "message": self.message}
        if self.value is not None:
            d["value"] = round(float(self.value), 3)
        if self.threshold is not None:
            d["threshold"] = self.threshold
        return d


@dataclass
class QualityReport:
    photo_type: str
    checks: List[Check] = field(default_factory=list)
    face_landmarks: Any = None
    pose_landmarks: Any = None

    @property
    def valid(self) -> bool:
        return bool(all(c.ok for c in self.checks))

    def as_dict(self) -> Dict[str, Any]:
        problems = [c.as_dict() for c in self.checks if not c.ok]
        return {
            "valid": self.valid,
            "type": self.photo_type,
            "modelVersion": VERSION,
            "problems": problems,
            "checks": [c.as_dict() for c in self.checks],
            "message": "La foto cumple las condiciones." if self.valid else problems[0]["message"],
        }


def _t(thresholds: Optional[Dict[str, float]]) -> Dict[str, float]:
    merged = dict(DEFAULT_THRESHOLDS)
    for k, v in (thresholds or {}).items():
        if k in merged and isinstance(v, (int, float)):
            merged[k] = float(v)
    return merged


def _general_checks(img: np.ndarray, t: Dict[str, float]) -> List[Check]:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    checks: List[Check] = []
    short = min(h, w)
    checks.append(Check("resolucion", short >= t["min_short_side_px"],
                        "La foto tiene poca resolución. Usa la cámara trasera o acércate un poco." if short < t["min_short_side_px"] else "Resolución suficiente.",
                        short, t["min_short_side_px"]))
    mean = float(gray.mean())
    if mean < t["min_brightness"]:
        checks.append(Check("iluminacion_baja", False, "La foto está oscura. Busca luz natural de frente, por ejemplo cerca de una ventana.", mean, t["min_brightness"]))
    elif mean > t["max_brightness"]:
        checks.append(Check("iluminacion_alta", False, "Hay demasiada luz. Evita el sol directo o el flash.", mean, t["max_brightness"]))
    else:
        checks.append(Check("iluminacion", True, "Iluminación adecuada.", mean))
    clipped = float((gray > 250).mean())
    checks.append(Check("sobreexposicion", clipped <= t["max_clipped_ratio"],
                        "Hay zonas quemadas por la luz. Aléjate de la fuente de luz directa." if clipped > t["max_clipped_ratio"] else "Sin zonas quemadas.",
                        clipped, t["max_clipped_ratio"]))
    std = float(gray.std())
    checks.append(Check("contraste", std >= t["min_contrast_std"],
                        "La imagen se ve plana o con niebla. Limpia la lente y mejora la luz." if std < t["min_contrast_std"] else "Contraste adecuado.",
                        std, t["min_contrast_std"]))
    scale = 512.0 / max(h, w)
    small = cv2.resize(gray, (max(1, int(w * scale)), max(1, int(h * scale)))) if scale < 1 else gray
    sharp = float(cv2.Laplacian(small, cv2.CV_64F).var())
    checks.append(Check("nitidez", sharp >= t["min_sharpness"],
                        "La foto está borrosa. Mantén el teléfono quieto y enfoca antes de capturar." if sharp < t["min_sharpness"] else "Foto nítida.",
                        sharp, t["min_sharpness"]))
    return checks


def face_geometry(lm_px: np.ndarray) -> Dict[str, float]:
    """Yaw aproximado (posición de la nariz entre los bordes) y roll (línea de ojos)."""
    left, right, nose = lm_px[234], lm_px[454], lm_px[1]
    span = max(1e-6, right[0] - left[0])
    yaw = abs((nose[0] - left[0]) / span - 0.5)
    eye_l, eye_r = lm_px[33], lm_px[263]
    roll = math.degrees(math.atan2(eye_r[1] - eye_l[1], eye_r[0] - eye_l[0]))
    if roll > 90:
        roll -= 180
    elif roll < -90:
        roll += 180
    return {"yaw": yaw, "roll": abs(roll)}


def _face_checks(img: np.ndarray, t: Dict[str, float], report: QualityReport) -> List[Check]:
    h, w = img.shape[:2]
    res = mpr.detect_faces(img)
    faces = res.face_landmarks or []
    if not faces:
        return [Check("rostro_no_detectado", False, "No encontramos un rostro. Mira a la cámara y retira lo que lo cubra (gafas de sol, mascarilla, cabello).")]
    if len(faces) > 1:
        return [Check("varios_rostros", False, "Aparece más de una persona. Toma la foto solo de tu rostro.", len(faces))]
    lm = mpr.landmarks_px(faces[0], w, h)
    report.face_landmarks = lm
    checks: List[Check] = [Check("rostro", True, "Rostro detectado.")]
    width_ratio = float((lm[:, 0].max() - lm[:, 0].min()) / w)
    if width_ratio < t["face_min_width_ratio"]:
        checks.append(Check("distancia_lejos", False, "Estás muy lejos. Acércate hasta que tu rostro llene el óvalo de la guía.", width_ratio, t["face_min_width_ratio"]))
    elif width_ratio > t["face_max_width_ratio"]:
        checks.append(Check("distancia_cerca", False, "Estás muy cerca. Aleja un poco el teléfono para que se vea todo tu rostro.", width_ratio, t["face_max_width_ratio"]))
    else:
        checks.append(Check("distancia", True, "Distancia adecuada.", width_ratio))
    xs, ys = lm[:, 0], lm[:, 1]
    cut = xs.min() < 2 or ys.min() < 2 or xs.max() > w - 2 or ys.max() > h - 2
    checks.append(Check("rostro_completo", not cut, "Parte de tu rostro queda fuera de la foto. Céntralo dentro de la guía." if cut else "Rostro completo."))
    geo = face_geometry(lm)
    checks.append(Check("orientacion", geo["yaw"] <= t["face_max_yaw"],
                        "Gira la cara hacia la cámara: necesitamos la foto de frente." if geo["yaw"] > t["face_max_yaw"] else "Rostro de frente.",
                        geo["yaw"], t["face_max_yaw"]))
    checks.append(Check("inclinacion", geo["roll"] <= t["face_max_roll_deg"],
                        "Tu cabeza está inclinada. Mantenla recta." if geo["roll"] > t["face_max_roll_deg"] else "Cabeza recta.",
                        geo["roll"], t["face_max_roll_deg"]))
    # Luz uniforme: compara la luminosidad de ambas mejillas
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    r = max(4, int(width_ratio * w * 0.06))

    def patch_l(pt):
        x, y = int(pt[0]), int(pt[1])
        p = lab[max(0, y - r):y + r, max(0, x - r):x + r, 0]
        return float(p.mean()) * 100 / 255 if p.size else 0.0

    diff = abs(patch_l(lm[50]) - patch_l(lm[280]))
    checks.append(Check("luz_lateral", diff <= t["face_max_side_light_diff"],
                        "La luz llega solo por un lado. Ponte de frente a la fuente de luz." if diff > t["face_max_side_light_diff"] else "Luz uniforme.",
                        diff, t["face_max_side_light_diff"]))
    return checks


# Índices de PoseLandmarker
NOSE, L_SH, R_SH, L_WR, R_WR, L_HIP, R_HIP, L_ANK, R_ANK = 0, 11, 12, 15, 16, 23, 24, 27, 28


def _body_checks(img: np.ndarray, t: Dict[str, float], report: QualityReport) -> List[Check]:
    h, w = img.shape[:2]
    res = mpr.detect_pose(img)
    poses = res.pose_landmarks or []
    if not poses:
        return [Check("cuerpo_no_detectado", False, "No encontramos tu cuerpo. Colócate a 2 o 3 metros, de frente y con fondo despejado.")]
    if len(poses) > 1:
        return [Check("varias_personas", False, "Aparece más de una persona. Toma la foto solo de tu cuerpo.", len(poses))]
    lms = poses[0]
    report.pose_landmarks = lms
    vis = lambda i: float(getattr(lms[i], "visibility", 1.0) or 0.0)  # noqa: E731
    checks: List[Check] = [Check("cuerpo", True, "Cuerpo detectado.")]
    needed = {"cabeza": [NOSE], "hombros": [L_SH, R_SH], "caderas": [L_HIP, R_HIP], "pies": [L_ANK, R_ANK]}
    missing = [name for name, idx in needed.items() if min(vis(i) for i in idx) < t["body_min_visibility"]]
    inside = all(0.0 <= lms[i].x <= 1.0 and 0.0 <= lms[i].y <= 1.0 for i in [NOSE, L_ANK, R_ANK])
    full = not missing and inside
    checks.append(Check("cuerpo_completo", full,
                        "Debe verse tu cuerpo completo, de la cabeza a los pies" + (f" (no se ve: {', '.join(missing)})." if missing else ".") if not full else "Cuerpo completo visible."))
    if not full:
        return checks
    top = min(lm.y for lm in lms)
    bottom = max(lms[L_ANK].y, lms[R_ANK].y)
    height_ratio = float(bottom - top)
    if height_ratio < t["body_min_height_ratio"]:
        checks.append(Check("distancia_lejos", False, "Estás muy lejos. Acércate hasta ocupar la silueta de la guía.", height_ratio, t["body_min_height_ratio"]))
    elif height_ratio > t["body_max_height_ratio"]:
        checks.append(Check("distancia_cerca", False, "Estás muy cerca. Aléjate un paso para que quepa todo tu cuerpo.", height_ratio, t["body_max_height_ratio"]))
    else:
        checks.append(Check("distancia", True, "Distancia adecuada.", height_ratio))
    tilt = abs(math.degrees(math.atan2((lms[R_SH].y - lms[L_SH].y) * h, (lms[R_SH].x - lms[L_SH].x) * w)))
    tilt = min(tilt, abs(180 - tilt))
    checks.append(Check("postura", tilt <= t["body_max_shoulder_tilt_deg"],
                        "Tus hombros están inclinados. Ponte recta con el peso en ambos pies." if tilt > t["body_max_shoulder_tilt_deg"] else "Postura recta.",
                        tilt, t["body_max_shoulder_tilt_deg"]))
    # De frente: la distancia entre hombros debe ser parecida a la de caderas*~1.1 y profundidad similar
    depth = abs(lms[L_SH].z - lms[R_SH].z)
    frontal = depth < 0.35
    checks.append(Check("frente", frontal, "Ponte de frente a la cámara, no de perfil." if not frontal else "Postura de frente.", depth, 0.35))
    # Brazos separados: las muñecas deben quedar fuera de la línea de cadera
    hip_l, hip_r = sorted([lms[L_HIP].x, lms[R_HIP].x])
    hip_w = max(1e-3, hip_r - hip_l)
    wrists = sorted([lms[L_WR].x, lms[R_WR].x])
    sep = min(hip_l - wrists[0], wrists[1] - hip_r) / hip_w
    arms_ok = sep > 0.15
    checks.append(Check("brazos", arms_ok, "Separa un poco los brazos del cuerpo para medir bien tu cintura y cadera." if not arms_ok else "Brazos separados.", sep, 0.15))
    return checks


def validate(img_bgr: np.ndarray, photo_type: str, thresholds: Optional[Dict[str, float]] = None) -> QualityReport:
    if photo_type not in {"rostro", "cuerpo", "prenda"}:
        raise ValueError("El tipo de foto debe ser 'rostro', 'cuerpo' o 'prenda'.")
    t = _t(thresholds)
    report = QualityReport(photo_type=photo_type)
    report.checks.extend(_general_checks(img_bgr, t))
    # Con la foto muy oscura o borrosa no se gasta inferencia (regla de HU-035)
    blocking = {"iluminacion_baja", "nitidez"}
    if any((not c.ok) and c.code in blocking for c in report.checks):
        return report
    if photo_type == "rostro":
        report.checks.extend(_face_checks(img_bgr, t, report))
    elif photo_type == "cuerpo":
        report.checks.extend(_body_checks(img_bgr, t, report))
    return report
