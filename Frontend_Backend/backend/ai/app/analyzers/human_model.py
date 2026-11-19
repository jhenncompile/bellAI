"""
HU-023: modelo humano base (MakeHuman, CC0) para el avatar.

Carga models/human/humano.bhm (lo genera scripts/build_human_model.py), aplica los parámetros
(peso, músculo, medidas…), mide el cuerpo resultante en centímetros y ajusta los parámetros para
que el modelo tenga las medidas del escaneo. La app hace lo mismo para dibujarlo y editarlo.
"""
from __future__ import annotations

import json
import math
import os
import struct
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "models", "human"))
MODEL_PATH = os.path.join(MODEL_DIR, "humano.bhm")
TEX_DIR = os.path.join(MODEL_DIR, "tex")

_TYPES = {"f32": "<f4", "u16": "<u2", "u32": "<u4", "i16": "<i2", "u8": "u1"}


class HumanModelMissing(RuntimeError):
    def __init__(self):
        super().__init__("Falta el modelo humano del avatar. Ejecuta: python scripts/build_human_model.py")


class HumanModel:
    def __init__(self, path: str = MODEL_PATH):
        if not os.path.exists(path):
            raise HumanModelMissing()
        raw = open(path, "rb").read()
        if raw[:4] != b"BHM1":
            raise ValueError("humano.bhm no tiene el formato esperado")
        (hlen,) = struct.unpack("<I", raw[4:8])
        self.header = json.loads(raw[8:8 + hlen].decode("utf-8"))
        self._data = raw[8 + hlen:]
        self.n = self.header["vertexCount"]
        self.base = self.arr("base").reshape(-1, 3).astype(np.float64)
        self.params = {p["name"]: p for p in self.header["params"]}
        self._deltas: Dict[str, Tuple[np.ndarray, np.ndarray]] = {}
        for p in self.header["params"]:
            for side in ("pos", "neg"):
                if side in p:
                    s = p[side]
                    self._deltas[f"{p['name']}.{side}"] = (self.arr(s["i"]).astype(np.int64),
                                                          self.arr(s["d"]).reshape(-1, 3).astype(np.float64) * s["scale"])
        self.rulers = {k: np.array(v, np.int64) for k, v in self.header["rulers"].items()}
        self.joints = {k: np.array(v, np.int64) for k, v in self.header["joints"].items()}
        self.body_map = self.arr("body.map").astype(np.int64)
        self.body_uv = self.arr("body.uv").reshape(-1, 2).astype(np.float64)
        self.body_idx = self.arr("body.idx").reshape(-1, 3).astype(np.int64)
        self.body_region = self.arr("body.region").astype(np.int64)
        self.regions = self.header["regions"]
        # Vértices que dibujan el cuerpo (para medir sin contar ojos ni ayudas)
        self.body_verts = np.unique(self.body_map)
        # Región de cada vértice original (para medir el tronco sin los brazos)
        self.vert_region = np.full(self.n, -1, np.int64)
        self.vert_region[self.body_map] = self.body_region
        self.trunk_verts = np.where(np.isin(self.vert_region, [self.regions["torso"], self.regions["pelvis"]]))[0]

    def arr(self, name: str) -> np.ndarray:
        a = self.header["arrays"][name]
        dtype = np.dtype(_TYPES[a["type"]])
        return np.frombuffer(self._data, dtype=dtype, count=a["length"], offset=a["offset"])

    # ------------------------------------------------------------ forma

    def apply(self, values: Dict[str, float]) -> np.ndarray:
        """Posiciones (metros, sin escalar) con los parámetros dados; los que faltan valen 0."""
        P = self.base.copy()
        for name, v in values.items():
            p = self.params.get(name)
            if p is None or not v:
                continue
            v = float(min(max(v, p["min"]), p["max"]))
            key = f"{name}.pos" if v > 0 else f"{name}.neg"
            if key not in self._deltas:
                continue
            idx, d = self._deltas[key]
            P[idx] += abs(v) * d
        return P

    def joint(self, P: np.ndarray, name: str) -> np.ndarray:
        return P[self.joints[name]].mean(axis=0)

    def bounds(self, P: np.ndarray) -> Tuple[float, float]:
        y = P[self.body_verts, 1]
        return float(y.min()), float(y.max())

    def measure(self, P: np.ndarray, height_cm: Optional[float] = None) -> Dict[str, float]:
        """Medidas en cm, escaladas a la estatura (si se da) como hace la app al dibujarlo."""
        lo, hi = self.bounds(P)
        s = (height_cm / 100.0) / (hi - lo) if height_cm else 1.0

        def loop(name):
            idx = self.rulers[name]
            pts = P[idx]
            return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum()) * s * 100

        sh_y = (self.joint(P, "l-shoulder")[1] + self.joint(P, "r-shoulder")[1]) / 2
        band = P[self.trunk_verts]
        band = band[(band[:, 1] > sh_y - 0.04) & (band[:, 1] < sh_y + 0.02)]
        shoulders = float(band[:, 0].max() - band[:, 0].min()) * s * 100 if len(band) else 0.0
        mid = P[self.body_verts]
        knee_y = self.joint(P, "l-knee")[1]
        crotch = mid[(np.abs(mid[:, 0]) < 0.012) & (mid[:, 1] > knee_y)]
        inseam = float(crotch[:, 1].min() - lo) * s * 100 if len(crotch) else 0.0
        arm = 0.0
        for side in ("l-", "r-"):
            a, b, c = (self.joint(P, side + j) for j in ("shoulder", "elbow", "hand"))
            arm += (np.linalg.norm(b - a) + np.linalg.norm(c - b)) / 2
        return {
            "estaturaCm": round((hi - lo) * s * 100, 1),
            "pechoCm": round(loop("bust-circ"), 1),
            "bajoBustoCm": round(loop("underbust-circ"), 1),
            "cinturaCm": round(loop("waist-circ"), 1),
            "caderaCm": round(loop("hips-circ"), 1),
            "anchoHombrosCm": round(shoulders, 1),
            "largoBrazoCm": round(arm * s * 100, 1),
            "entrepiernaCm": round(inseam, 1),
            "musloCm": round(loop("thigh-circ"), 1),
            "cuelloCm": round(loop("neck-circ"), 1),
        }

    # ------------------------------------------------------------ ajuste

    FIT_PARAMS = ["peso", "musculo", "copa", "pecho", "bajoBusto", "cintura", "cadera", "hombros", "muslo", "cuello", "piernas", "largoBrazo"]
    # Qué tan fiable es cada medida del escaneo (las de la silueta frontal, más)
    FIT_WEIGHTS = {"pechoCm": 1.0, "bajoBustoCm": 0.6, "cinturaCm": 1.2, "caderaCm": 1.2, "anchoHombrosCm": 0.8,
                   "largoBrazoCm": 0.4, "entrepiernaCm": 0.8, "musloCm": 0.5, "cuelloCm": 0.3}

    def fit(self, target: Dict[str, float], height_cm: float, fixed: Optional[Dict[str, float]] = None,
            iters: int = 12, reg: float = 0.02) -> Dict[str, float]:
        """
        Parámetros que hacen que el modelo (escalado a la estatura) tenga las medidas del escaneo.
        Gauss-Newton con jacobiano numérico, regularizado hacia 0 (cuerpo promedio) y acotado a [-1, 1].
        """
        fixed = dict(fixed or {})
        names = [n for n in self.FIT_PARAMS if n in self.params and n not in fixed]
        keys = [k for k in self.FIT_WEIGHTS if target.get(k)]
        if not keys:
            return {**{n: 0.0 for n in names}, **fixed}
        w = np.array([self.FIT_WEIGHTS[k] for k in keys])
        t = np.array([float(target[k]) for k in keys])
        x = np.zeros(len(names))

        def residual(xv):
            m = self.measure(self.apply({**fixed, **dict(zip(names, xv))}), height_cm)
            return w * (np.array([m[k] for k in keys]) - t) / t

        for _ in range(iters):
            r = residual(x)
            J = np.zeros((len(r), len(names)))
            h = 0.05
            for j in range(len(names)):
                xp = x.copy()
                xp[j] = xp[j] + h if xp[j] + h <= 1 else xp[j] - h
                J[:, j] = (residual(xp) - r) / (xp[j] - x[j])
            A = J.T @ J + reg * np.eye(len(names))
            step = np.linalg.solve(A, -(J.T @ r) - reg * x)
            x_new = np.clip(x + step, -1, 1)
            if np.abs(x_new - x).max() < 1e-3:
                x = x_new
                break
            x = x_new
        return {**fixed, **{n: round(float(v), 3) for n, v in zip(names, x)}}

    # ------------------------------------------------------------ pelo y cejas

    def proxy(self, P: np.ndarray, key: str) -> Optional[Tuple[np.ndarray, np.ndarray, np.ndarray]]:
        """Posiciones de dibujo, UVs e índices de un pelo/cejas ajustado a la forma actual."""
        pre = f"proxy.{key}"
        if f"{pre}.refs" not in self.header.get("arrays", {}):
            return None
        refs = self.arr(f"{pre}.refs").reshape(-1, 3).astype(np.int64)
        if len(refs) == 0:
            return None
        w = self.arr(f"{pre}.w").reshape(-1, 3).astype(np.float64)
        off = self.arr(f"{pre}.off").reshape(-1, 3).astype(np.float64)
        scales = self.header["proxies"][key]["scales"]
        sc = np.ones(3)
        for i, axis in enumerate("xyz"):
            if axis in scales:
                a, b, s = scales[axis]
                sc[i] = abs(P[a][i] - P[b][i]) / s if s else 1.0
        V = (P[refs] * w[:, :, None]).sum(axis=1) + off * sc
        pmap = self.arr(f"{pre}.map").astype(np.int64)
        if len(pmap) == 0 or pmap.max() >= len(V):
            return None
        return V[pmap], self.arr(f"{pre}.uv").reshape(-1, 2), self.arr(f"{pre}.idx").reshape(-1, 3).astype(np.int64)


@lru_cache(maxsize=1)
def load() -> HumanModel:
    return HumanModel()


def available() -> bool:
    return os.path.exists(MODEL_PATH)


def face_keypoints(m: HumanModel, P: np.ndarray) -> Dict[str, np.ndarray]:
    """Puntos de la cara del modelo (x, y en metros, vista de frente) que casan con MediaPipe."""
    head = P[np.where(m.vert_region == m.regions["cabeza"])[0]]
    le, re = m.joint(P, "l-eye"), m.joint(P, "r-eye")
    eye_y = (le[1] + re[1]) / 2
    mid = head[np.abs(head[:, 0]) < 0.004]
    nose = mid[np.argmax(mid[:, 2])]
    # Perfil exterior de la línea media (la z máxima por franja de altura; dentro de la boca hay más vértices)
    upper = P[m.body_verts]
    upper = upper[upper[:, 1] > m.joint(P, "neck")[1]]
    allmid = upper[np.abs(upper[:, 0]) < 0.005]
    ys = np.arange(nose[1] - 0.003, nose[1] - 0.09, -0.0015)
    prof = []
    for y in ys:
        sel = allmid[np.abs(allmid[:, 1] - y) < 0.00125]
        if len(sel):
            prof.append((y, sel[:, 2].max()))
    prof_arr = np.array(prof)
    # Boca: hendidura de los labios = mínimo de la z exterior entre 2 y 3,4 cm bajo la nariz (más abajo está el surco del mentón)
    lip = prof_arr[(prof_arr[:, 0] < nose[1] - 0.02) & (prof_arr[:, 0] > nose[1] - 0.034)]
    seam_y = float(lip[np.argmin(lip[:, 1]), 0]) if len(lip) else nose[1] - 0.028
    # Barbilla (mentón, el 152 de MediaPipe): bajando desde la boca, el último punto donde el perfil
    # sigue delante (antes de meterse bajo la mandíbula hacia el cuello)
    chin_y = seam_y - 0.04
    for y in np.arange(seam_y - 0.012, seam_y - 0.08, -0.0015):
        sel = allmid[np.abs(allmid[:, 1] - y) < 0.0025]
        if len(sel) and sel[:, 2].max() < nose[2] - 0.03:
            chin_y = float(y + 0.0015)
            break
    mouth = np.array([0.0, seam_y, 0.0])
    chin = np.array([0.0, chin_y, 0.0])
    # Lados de la cara a la altura de los ojos (pómulos), solo la mitad delantera
    band = head[(np.abs(head[:, 1] - (eye_y - 0.015)) < 0.008) & (head[:, 2] > le[2] - 0.05)]
    left = band[np.argmax(band[:, 0])]
    right = band[np.argmin(band[:, 0])]
    return {"ojo_d": re, "ojo_i": le, "nariz": nose, "boca": mouth, "barbilla": chin, "lado_d": right, "lado_i": left}


def hex_to_rgb(hex_str: str, default: Tuple[int, int, int] = (200, 160, 130)) -> Tuple[int, int, int]:
    h = str(hex_str or "").strip().lstrip("#")
    if len(h) == 6:
        try:
            return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        except ValueError:
            pass
    return default


def build_mesh(config: Dict[str, Any]) -> Dict[str, Any]:
    """Genera la malla tridimensional completa y continua a partir del modelo humano base (MakeHuman CC0)."""
    hm = load()

    # Parámetros morfométricos
    complexion = str(config.get("complexion") or "Equilibrada")
    complexion_scale = float(config.get("complexionScale") or 1.0)
    height_scale = float(config.get("heightScale") or 1.0)
    height_cm = float(config.get("heightCm") or config.get("height_cm") or (168.0 * height_scale))
    height_m = max(1.2, min(2.2, height_cm / 100.0))

    body_type = str(config.get("bodyType") or "").lower()
    props = config.get("proportions") or {}
    shoulder_ratio = float(props.get("shoulder") or 1.0)
    waist_ratio = float(props.get("waist") or 0.75)
    hip_ratio = float(props.get("hip") or 1.0)
    leg_ratio = float(props.get("legToBody") or 0.58)

    # Cálculo calibrado de morfos
    weight_val = float(np.clip((complexion_scale - 1.0) * 2.4, -1.0, 1.0))
    muscle_val = 0.0
    cup_val = 0.0

    if complexion == "Esbelta":
        weight_val = min(weight_val, -0.45)
    elif complexion == "Atlética":
        muscle_val = 0.55
        weight_val = min(weight_val, 0.1)
    elif complexion == "Curvilínea":
        weight_val = max(weight_val, 0.3)
        cup_val = 0.35
    elif complexion == "Plena":
        weight_val = max(weight_val, 0.65)
        cup_val = 0.45

    waist_morph = float(np.clip((waist_ratio / 0.75 - 1.0) * 2.2, -1.0, 1.0))
    hip_morph = float(np.clip((hip_ratio - 1.0) * 1.8, -1.0, 1.0))
    shoulder_morph = float(np.clip((shoulder_ratio - 1.0) * 2.0, -1.0, 1.0))

    if "pera" in body_type or ("triangulo" in body_type and "invertido" not in body_type):
        hip_morph = float(np.clip(hip_morph + 0.45, -1.0, 1.0))
        shoulder_morph = float(np.clip(shoulder_morph - 0.25, -1.0, 1.0))
    elif "invertido" in body_type:
        shoulder_morph = float(np.clip(shoulder_morph + 0.45, -1.0, 1.0))
        hip_morph = float(np.clip(hip_morph - 0.2, -1.0, 1.0))
        muscle_val = max(muscle_val, 0.3)
    elif "reloj de arena" in body_type:
        waist_morph = float(np.clip(waist_morph - 0.4, -1.0, 1.0))
        hip_morph = float(np.clip(hip_morph + 0.35, -1.0, 1.0))
        cup_val = max(cup_val, 0.3)
    elif "manzana" in body_type or "ovalada" in body_type:
        waist_morph = float(np.clip(waist_morph + 0.5, -1.0, 1.0))
        weight_val = max(weight_val, 0.35)

    leg_morph = float(np.clip((leg_ratio - 0.58) * 6.0, -1.0, 1.0))

    params = {
        "peso": weight_val,
        "musculo": muscle_val,
        "genero": 0.0,
        "copa": cup_val,
        "cintura": waist_morph,
        "cadera": hip_morph,
        "hombros": shoulder_morph,
        "piernas": leg_morph,
    }

    # Deformar la malla base humana con sus morfos
    P = hm.apply(params)
    lo, hi = hm.bounds(P)
    scale = height_m / max(hi - lo, 0.1)
    P = P * scale
    P[:, 1] -= lo * scale  # Apoyar los pies en y = 0

    # Extraer piel, ojos y cabello
    skin_rgb = hex_to_rgb(config.get("skinHex"), (201, 154, 122))
    eye_rgb = hex_to_rgb(config.get("eyeColorHex"), (93, 64, 55))
    hair_rgb = hex_to_rgb(config.get("hairHex"), (59, 42, 32))

    # 1. Cuerpo
    body_pts = P[hm.body_map]
    n_body = len(body_pts)
    body_col = np.tile(skin_rgb, (n_body, 1))
    body_reg = hm.body_region.copy()
    body_idx = hm.body_idx.copy()

    pos_list = [body_pts]
    col_list = [body_col]
    reg_list = [body_reg]
    idx_list = [body_idx]
    vert_offset = n_body

    # 2. Ojos (esclera + iris)
    eyes_map = hm.arr("eyes.map")
    eyes_pts = P[eyes_map]
    n_eyes = len(eyes_pts)
    eyes_idx = hm.arr("eyes.idx").reshape(-1, 3) + vert_offset
    eyes_reg = np.full(n_eyes, hm.regions["rostro"], dtype=np.int64)

    eyes_col = np.full((n_eyes, 3), 245, dtype=np.int64)
    z_max = eyes_pts[:, 2].max()
    is_front = eyes_pts[:, 2] > (z_max - 0.007)
    eyes_col[is_front] = eye_rgb

    pos_list.append(eyes_pts)
    col_list.append(eyes_col)
    reg_list.append(eyes_reg)
    idx_list.append(eyes_idx)
    vert_offset += n_eyes

    # 3. Cejas integradas
    brow_res = hm.proxy(P, "cejas") if "cejas" in hm.header.get("proxies", {}) else None
    if brow_res is not None:
        brow_pts, _, brow_idx = brow_res
        n_brow = len(brow_pts)
        brow_idx_shifted = brow_idx + vert_offset
        brow_reg = np.full(n_brow, hm.regions["rostro"], dtype=np.int64)
        brow_col = np.tile(np.clip(np.array(hair_rgb) * 0.75, 0, 255).astype(int), (n_brow, 1))

        pos_list.append(brow_pts)
        col_list.append(brow_col)
        reg_list.append(brow_reg)
        idx_list.append(brow_idx_shifted)
        vert_offset += n_brow

    # 4. Cabello según estilo
    style_str = str(config.get("hairStyle") or "Liso").lower()
    proxy_candidates = ["bob"]
    if "afro" in style_str:
        proxy_candidates = ["afro", "bob"]
    elif "coleta" in style_str or "recogido" in style_str:
        proxy_candidates = ["bob", "corto"]
    elif "corto" in style_str or "pixie" in style_str:
        proxy_candidates = ["corto", "bob"]
    elif "bob" in style_str:
        proxy_candidates = ["bob", "corto"]
    else:
        proxy_candidates = ["bob", "afro", "corto"]

    hair_res = None
    for cand in proxy_candidates:
        hair_res = hm.proxy(P, cand)
        if hair_res is not None:
            break

    if hair_res is not None:
        hair_pts, _, hair_idx = hair_res
        n_hair = len(hair_pts)
        hair_idx_shifted = hair_idx + vert_offset
        hair_reg = np.full(n_hair, hm.regions["cabello"], dtype=np.int64)
        hair_col = np.tile(hair_rgb, (n_hair, 1))

        pos_list.append(hair_pts)
        col_list.append(hair_col)
        reg_list.append(hair_reg)
        idx_list.append(hair_idx_shifted)
        vert_offset += n_hair

    # Ensamblar malla final continua
    all_pos = np.concatenate(pos_list, axis=0)
    all_col = np.concatenate(col_list, axis=0)
    all_reg = np.concatenate(reg_list, axis=0)
    all_idx = np.concatenate(idx_list, axis=0)

    keypoints = face_keypoints(hm, P)
    waist_pts = P[hm.rulers["waist-circ"]]
    waist_y = float(waist_pts[:, 1].mean()) if len(waist_pts) else height_m * 0.62

    levels = {
        "height": round(float(height_m), 4),
        "chin_h": round(float(keypoints["barbilla"][1]), 4),
        "shoulder_h": round(float((hm.joint(P, "l-shoulder")[1] + hm.joint(P, "r-shoulder")[1]) / 2), 4),
        "chest_h": round(float(hm.joint(P, "spine-3")[1]), 4),
        "waist_h": round(waist_y, 4),
        "hip_h": round(float(hm.joint(P, "pelvis")[1]), 4),
        "crotch_h": round(float(hm.joint(P, "l-upper-leg")[1] - 0.08), 4),
        "knee_h": round(float(hm.joint(P, "l-knee")[1]), 4),
        "ankle_h": round(float(hm.joint(P, "l-ankle")[1]), 4),
    }

    return {
        "positions": [round(float(v), 4) for v in all_pos.reshape(-1)],
        "colors": [int(round(v)) for v in all_col.reshape(-1)],
        "regions": [int(v) for v in all_reg],
        "indices": [int(v) for v in all_idx.reshape(-1)],
        "regionNames": hm.regions,
        "levels": levels,
    }

