"""HU-023: avatar maniquí (MakeHuman CC0) con siluetas base, cabello por mechones y ropa básica portable.

build_mesh(config) devuelve la malla en el formato que ya usa la app (positions, colors, regions, indices,
regionNames, levels, applied) más `garments`: una pieza por prenda pedida. Sin prendas pedidas, el maniquí
lleva la ropa genérica (blusa básica crema y short negro): nunca se muestra sin ropa.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from . import body as B
from . import garments as G

PRESETS = {
    "rectangulo": "Rectángulo",
    "pera": "Pera",
    "reloj": "Reloj de arena",
    "triangulo_invertido": "Triángulo invertido",
    "redondo": "Redondo",
}
DEFAULT_PRESET = "reloj"
GARMENT_KINDS = ("camiseta", "blusa_v", "blusa_basica", "top", "blazer", "pantalon_recto", "pantalon_ancho",
                 "short", "falda_a", "falda_lapiz", "vestido")
GENERIC_OUTFIT = [{"kind": "blusa_basica", "color": "#E2D4BA"}, {"kind": "short", "color": "#2B2B2E"}]
MANNEQUIN_RGB = (236, 234, 232)


def preset_from(value: Optional[str]) -> str:
    """Acepta el id («pera») o el nombre de la silueta del análisis («Pera», «Reloj de arena»…)."""
    v = (value or "").strip().lower()
    if v in PRESETS:
        return v
    for key, name in PRESETS.items():
        if name.lower() == v:
            return key
    if "pera" in v or ("triángulo" in v and "invertido" not in v) or ("triangulo" in v and "invertido" not in v):
        return "pera"
    if "invertido" in v:
        return "triangulo_invertido"
    if "reloj" in v:
        return "reloj"
    if "manzana" in v or "ovalad" in v or "redond" in v:
        return "redondo"
    if "rect" in v:
        return "rectangulo"
    return DEFAULT_PRESET


def hair_key(config: Dict[str, Any]) -> str:
    length = {"Corto": "corto", "Medio": "medio", "Largo": "largo"}.get(str(config.get("hairLength") or "Medio"), "medio")
    style = str(config.get("hairStyle") or "Liso")
    if style in ("Bob", "Pixie"):
        length = "corto"
    texture = "ondulado" if style in ("Ondulado", "Rizado", "Afro") else "lacio"
    fringe = "fleco" if config.get("hairFringe") else "sin"
    return f"gen:{length}:{texture}:{fringe}"


def fit_from_measurements(m: Dict[str, float]) -> Dict[str, Any]:
    """Medidas del escaneo → silueta base del maniquí y ajustes (escalas 0,85–1,15 respecto a la silueta).

    Clasificación habitual por contornos: busto vs. cadera y cintura respecto a ambos."""
    bust, waist, hip = float(m["pechoCm"]), float(m["cinturaCm"]), float(m["caderaCm"])
    top = max(bust, m["anchoHombrosCm"] * 2.3)  # hombros anchos cuentan como «arriba»
    if waist >= 0.92 * max(bust, hip):
        preset = "redondo"
    elif top - hip > 0.05 * hip:
        preset = "triangulo_invertido"
    elif hip - top > 0.05 * hip:
        preset = "pera"
    elif waist <= 0.75 * min(bust, hip):
        preset = "reloj"
    else:
        preset = "rectangulo"
    clip = lambda v: round(float(min(1.15, max(0.85, v))), 2)  # noqa: E731
    # Referencia: maniquí de 88-70-96 cm; el ajuste es suave para no deformar la silueta elegida
    return {
        "preset": preset,
        "heightCm": m["estaturaCm"],
        "heightScale": clip(m["estaturaCm"] / 168.0),
        "bustScale": clip(1 + (bust / 88.0 - 1) * 0.5),
        "waistScale": clip(1 + (waist / 70.0 - 1) * 0.5),
        "hipsScale": clip(1 + (hip / 96.0 - 1) * 0.5),
    }


def _hex(value: Any, default: Tuple[int, int, int]) -> np.ndarray:
    h = str(value or "").strip().lstrip("#")
    if len(h) == 6:
        try:
            return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
        except ValueError:
            pass
    return np.array(default, float)


def _num(config: Dict[str, Any], key: str, lo: float, hi: float) -> float:
    try:
        v = float(config.get(key) if config.get(key) is not None else 1.0)
    except (TypeError, ValueError):
        v = 1.0
    return float(min(hi, max(lo, v)))


@lru_cache(maxsize=24)
def _body(preset: str, extras: Tuple[Tuple[str, float], ...], height: float):
    """Cuerpo de maniquí deformado (con caché: es lo más costoso)."""
    params = dict(B.BASE)
    for k, v in B.PRESETS[PRESETS[preset]].items():
        params[k] = params.get(k, 0.0) + v
    for k, v in extras:
        params[k] = float(np.clip(params.get(k, 0.0) + v, -1.0, 1.0))
    P = B.M.apply(params)
    lo, hi = B.M.bounds(P)
    P = (P - [0, lo, 0]) * (1.68 * height / (hi - lo))
    P = B.slim_hands(B.lower_arms(P, 22.0))
    chin = B.hm.face_keypoints(B.M, P)["barbilla"][1]
    body = B.weld(B.smooth_body(B.weld(B.smooth_trunk(B.weld(B.face_by_mode(P[B.M.body_map], chin))))))
    eyes_p, eyes_f = B.eyes_by_mode(P, body, chin)
    waist_y = float(P[B.M.rulers["waist-circ"]][:, 1].mean())
    return P, body, eyes_p, eyes_f, waist_y


@lru_cache(maxsize=48)
def _hair(preset: str, extras: Tuple[Tuple[str, float], ...], height: float, key: str):
    P, body, _, _, _ = _body(preset, extras, height)
    return B.hair_layers(P, body, key)


def _compact(V: np.ndarray, F: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    used = np.unique(F)
    remap = -np.ones(len(V), int)
    remap[used] = np.arange(len(used))
    return V[used], remap[F]


def build_mesh(config: Dict[str, Any]) -> Dict[str, Any]:
    preset = preset_from(config.get("preset") or config.get("bodyType"))
    height = _num(config, "heightScale", 0.85, 1.15)
    bust, waist, hips, comp = (_num(config, k, 0.7, 1.4) for k in ("bustScale", "waistScale", "hipsScale", "complexionScale"))
    extras = tuple((k, round(v, 2)) for k, v in (("copa", (bust - 1) * 2.5), ("cintura", (waist - 1) * 3.0),
                                                  ("cadera", (hips - 1) * 3.0), ("peso", (comp - 1) * 2.0)) if abs(v) > 1e-3)
    P, body, eyes_p, eyes_f, waist_y = _body(preset, extras, round(height, 3))
    M, R = B.M, B.R

    # Regiones: las de MakeHuman + «hombro» (mitad del brazo cercana al hombro, para mangas cortas)
    reg = M.body_region.copy()
    names = dict(R)
    names["hombro"] = 12
    for side in ("l", "r"):
        sh, el = M.joint(P, f"{side}-shoulder"), M.joint(P, f"{side}-elbow")
        near = (reg == R["brazo"]) & (np.sign(body[:, 0]) == np.sign(sh[0])) & \
               (np.linalg.norm(body - sh, axis=1) < np.linalg.norm(el - sh) * 0.5)
        reg[near] = 12

    skin = np.array(MANNEQUIN_RGB, float)
    pos: List[np.ndarray] = [body, eyes_p]
    idx: List[np.ndarray] = [M.body_idx, eyes_f + len(body)]
    regs: List[np.ndarray] = [reg, np.full(len(eyes_p), R["cabeza"])]
    cols: List[np.ndarray] = [np.tile(skin, (len(body), 1)), np.tile(skin, (len(eyes_p), 1))]
    off = len(body) + len(eyes_p)

    # Cabello: capas (base en el cuero cabelludo + mechones), teñidas con el color elegido
    hair_rgb = _hex(config.get("hairHex"), (59, 42, 32))
    tint = hair_rgb / B.HAIR_COL
    for V, F, col, _ in _hair(preset, extras, round(height, 3), hair_key(config)):
        V, F = _compact(np.asarray(V, float), np.asarray(F, int))
        fc = np.asarray(col, float)
        fc = np.tile(fc, (len(F), 1)) if fc.ndim == 1 else fc
        vc = np.zeros((len(V), 3))
        cnt = np.zeros(len(V))
        np.add.at(vc, F.reshape(-1), np.repeat(fc, 3, axis=0))
        np.add.at(cnt, F.reshape(-1), 1)
        vc = np.clip(vc / np.maximum(cnt, 1)[:, None] * tint, 0, 255)
        pos.append(V); idx.append(F + off); regs.append(np.full(len(V), R["cabello"])); cols.append(vc)
        off += len(V)

    kp = B.hm.face_keypoints(M, P)
    h = float(P[:, 1].max())
    levels = {
        "height": h,
        "chin_h": float(kp["barbilla"][1]),
        "shoulder_h": float((M.joint(P, "l-shoulder")[1] + M.joint(P, "r-shoulder")[1]) / 2),
        "chest_h": float(waist_y + 0.2 * height),
        "waist_h": waist_y,
        "hip_h": float(M.joint(P, "pelvis")[1]),
        "crotch_h": float(M.joint(P, "l-upper-leg")[1] - 0.08),
        "knee_h": float(M.joint(P, "l-knee")[1]),
        "ankle_h": float(M.joint(P, "l-ankle")[1]),
    }

    # Ropa: la pedida o, si no se pidió ninguna, la genérica
    wanted = config.get("garments")
    if not isinstance(wanted, list) or not wanted:
        wanted = GENERIC_OUTFIT
    gb = G.Body(body, M.body_idx, M.body_region, R, lambda n: M.joint(P, n), waist_y, M.body_map)
    garments = []
    for item in wanted[:6]:
        kind = str((item or {}).get("kind") or "")
        if kind not in GARMENT_KINDS:
            continue
        V, F = G.make(gb, kind)
        garments.append({
            "kind": kind,
            "positions": [round(float(v), 3) for v in np.asarray(V).reshape(-1)],
            "indices": [int(v) for v in np.asarray(F).reshape(-1)],
            "color": [int(v) for v in _hex(item.get("color"), (203, 184, 157))],
        })

    return {
        "style": "maniqui",
        "preset": preset,
        "positions": [round(float(v), 3) for v in np.vstack(pos).reshape(-1)],
        "colors": [int(round(v)) for v in np.vstack(cols).reshape(-1)],
        "regions": [int(v) for v in np.concatenate(regs)],
        "indices": [int(v) for v in np.vstack(idx).reshape(-1)],
        "regionNames": names,
        "levels": {k: round(v, 4) for k, v in levels.items()},
        # El servidor ya aplicó estos valores: la app no los vuelve a aplicar
        "applied": {"heightScale": height, "bustScale": bust, "waistScale": waist, "hipsScale": hips, "complexionScale": comp},
        "garments": garments,
    }
