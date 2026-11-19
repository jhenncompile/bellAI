"""
HU-023: arma el modelo humano base del avatar a partir de los recursos de MakeHuman 1.1
(malla base, morfos y texturas publicados bajo CC0 1.0; ver LICENSE.ASSETS.md de MakeHuman).

Uso (desde backend/ai):
    python scripts/build_human_model.py            # descarga lo que falte y genera models/human/

Genera:
- models/human/humano.bhm: binario con la malla (metros, Y arriba, mirando a +Z), UVs, regiones del
  cuerpo, morfos (peso, músculo, medidas…), reglas de medida, articulaciones y el pelo/cejas como
  «proxies» enlazados a la malla (siguen a los morfos).
- models/human/tex/: piel base, ojos, pelo y cejas (el pelo y las cejas en gris para teñirlos).

Formato .bhm: "BHM1" · uint32 largo de la cabecera · cabecera JSON (UTF-8, rellena a 4 bytes) ·
datos. La cabecera describe cada arreglo {offset, length, type} relativo al inicio de los datos.
"""
from __future__ import annotations

import json
import os
import re
import struct
import sys
import urllib.request
from typing import Dict, List, Tuple

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "models", "human")
SRC = os.path.join(OUT, "src")
TEX = os.path.join(OUT, "tex")

GH = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman"
ASSETS = "https://download.tuxfamily.org/makehuman/assets/1.1/base"
DM_TO_M = 0.1  # MakeHuman trabaja en decímetros

MACRO = "data/targets/macrodetails"
# La forma de mujer/hombre joven está en los morfos de etnia: se usa el promedio de las tres
ETHNIC = ["african", "asian", "caucasian"]
F = "universal-female-young"
M = "universal-male-young"

# Parámetros del avatar: (nombre, etiqueta, target positivo(s), target negativo(s), solo positivo)
# Los macro se guardan como diferencia respecto a la mujer joven promedio (la base).
PARAMS: List[Tuple[str, str, List[str], List[str], bool]] = [
    ("peso", "Peso", [f"{MACRO}/{F}-averagemuscle-maxweight"], [f"{MACRO}/{F}-averagemuscle-minweight"], False),
    ("musculo", "Musculatura", [f"{MACRO}/{F}-maxmuscle-averageweight"], [f"{MACRO}/{F}-minmuscle-averageweight"], False),
    ("genero", "Rasgos masculinos", [f"{MACRO}/{e}-male-young" for e in ETHNIC], [], True),
    ("copa", "Busto (copa)", ["data/targets/breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness"],
     ["data/targets/breast/female-young-averagemuscle-averageweight-mincup-averagefirmness"], False),
]
MEASURE = {
    "pecho": ("Pecho", ["bust-circ"]),
    "bajoBusto": ("Bajo busto", ["underbust-circ"]),
    "cintura": ("Cintura", ["waist-circ"]),
    "cadera": ("Cadera", ["hips-circ"]),
    "hombros": ("Hombros", ["shoulder-dist"]),
    "muslo": ("Muslo", ["thigh-circ"]),
    "pantorrilla": ("Pantorrilla", ["calf-circ"]),
    "brazo": ("Brazo", ["upperarm-circ"]),
    "cuello": ("Cuello", ["neck-circ"]),
    "piernas": ("Largo de piernas", ["upperleg-height", "lowerleg-height"]),
    "torso": ("Largo de torso", ["napetowaist-dist"]),
    "largoBrazo": ("Largo de brazos", ["upperarm-length", "lowerarm-length"]),
}
RULERS = ["bust-circ", "underbust-circ", "waist-circ", "hips-circ", "neck-circ", "thigh-circ", "upperarm-circ", "calf-circ"]

JOINTS = ["ground", "pelvis", "spine-1", "spine-2", "spine-3", "spine-4", "neck", "head", "head-2", "jaw", "mouth",
          "l-eye", "r-eye", "l-clavicle", "r-clavicle", "l-shoulder", "r-shoulder", "l-elbow", "r-elbow", "l-hand", "r-hand",
          "l-finger-3-4", "r-finger-3-4", "l-upper-leg", "r-upper-leg", "l-knee", "r-knee", "l-ankle", "r-ankle",
          "l-toe-1-3", "r-toe-1-3"]

HAIR = {"corto": "short02", "bob": "bob02", "largo": "long01", "coleta": "ponytail01", "afro": "afro01"}
EYES = ["brownlight", "blue", "bluegreen", "green", "grey", "deepblue", "lightblue", "ice"]

REGIONS = {"cabeza": 0, "rostro": 1, "cabello": 2, "cuello": 3, "torso": 4, "pelvis": 5, "brazo": 6,
           "antebrazo": 7, "mano": 8, "muslo": 9, "pierna": 10, "pie": 11}


def fetch(url: str, name: str) -> str:
    path = os.path.join(SRC, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"  descargando {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "bellai-build/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path + ".part", "wb") as f:
        f.write(r.read())
    os.replace(path + ".part", path)
    return path


def read_target(rel: str, n: int) -> np.ndarray:
    path = fetch(f"{GH}/{rel}.target", rel.replace("/", "__") + ".target")
    d = np.zeros((n, 3), np.float64)
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                d[int(p[0])] = (float(p[1]), float(p[2]), float(p[3]))
    return d * DM_TO_M


def parse_obj(path: str):
    """Vértices, UVs y caras (con grupo) de un .obj; las caras guardan (v, vt) por esquina."""
    vs, vts, faces = [], [], []
    group = ""
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                vs.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                vts.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                group = line.split(maxsplit=1)[1].strip()
            elif line.startswith("f "):
                corners = []
                for c in line.split()[1:]:
                    p = c.split("/")
                    corners.append((int(p[0]) - 1, int(p[1]) - 1 if len(p) > 1 and p[1] else -1))
                faces.append((group, corners))
    return np.array(vs, np.float64), np.array(vts, np.float64) if vts else np.zeros((0, 2)), faces


def split_render(faces, groups=None):
    """Triángulos con un vértice de dibujo por par (v, vt). Devuelve map (v original), vt y triángulos."""
    key: Dict[Tuple[int, int], int] = {}
    vmap, vtmap, tris = [], [], []
    for g, corners in faces:
        if groups is not None and g not in groups:
            continue
        ids = []
        for c in corners:
            if c not in key:
                key[c] = len(vmap)
                vmap.append(c[0])
                vtmap.append(c[1])
            ids.append(key[c])
        for i in range(1, len(ids) - 1):
            tris.append((ids[0], ids[i], ids[i + 1]))
    return np.array(vmap, np.int64), np.array(vtmap, np.int64), np.array(tris, np.int64)


def parse_mhclo(path: str):
    refs, weights, offsets, scales, obj = [], [], [], {}, None
    in_verts = False
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            p = line.split()
            if not p or p[0].startswith("#"):
                continue
            if p[0] in ("x_scale", "y_scale", "z_scale"):
                scales[p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
            elif p[0] == "obj_file":
                obj = p[1]
            elif p[0] == "verts":
                in_verts = True
            elif p[0] == "delete_verts":
                in_verts = False
            elif p[0] in ("material", "name", "uuid", "tag", "basemesh", "z_depth", "max_pole", "vertexboneweights_file"):
                # Metadatos: en long01 y ponytail01 «material» va justo después de «verts 0», así que no
                # pueden cerrar el bloque de vértices (antes esos dos peinados quedaban sin ajuste).
                continue
            elif in_verts:
                if len(p) == 1:
                    refs.append((int(p[0]),) * 3)
                    weights.append((1.0, 0.0, 0.0))
                    offsets.append((0.0, 0.0, 0.0))
                elif len(p) >= 9:
                    refs.append((int(p[0]), int(p[1]), int(p[2])))
                    weights.append((float(p[3]), float(p[4]), float(p[5])))
                    offsets.append((float(p[6]), float(p[7]), float(p[8])))
                else:
                    in_verts = False
    return np.array(refs, np.int64), np.array(weights, np.float64), np.array(offsets, np.float64) * DM_TO_M, scales, obj


def gray_tint(src: str, dst: str, size: int):
    """Textura en gris (con alfa) normalizada: el color final sale de multiplicar por el color de pelo."""
    img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 3:
        img = np.dstack([img, np.full(img.shape[:2], 255, np.uint8)])
    img = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
    lum = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY).astype(np.float64)
    a = img[:, :, 3] > 128
    mean = lum[a].mean() if a.any() else lum.mean()
    g = np.clip(lum * (200.0 / max(mean, 1)), 0, 255).astype(np.uint8)
    cv2.imwrite(dst, np.dstack([g, g, g, img[:, :, 3]]))


class Blob:
    def __init__(self):
        self.parts: List[bytes] = []
        self.size = 0
        self.index: Dict[str, dict] = {}

    def add(self, name: str, arr: np.ndarray, typ: str):
        dtype = {"f32": "<f4", "u16": "<u2", "u32": "<u4", "i16": "<i2", "u8": "u1"}[typ]
        data = np.ascontiguousarray(arr, dtype=dtype).tobytes()
        self.index[name] = {"offset": self.size, "length": int(np.asarray(arr).size), "type": typ}
        pad = (-len(data)) % 4
        self.parts.append(data + b"\0" * pad)
        self.size += len(data) + pad
        return name


def sparse(blob: Blob, name: str, delta: np.ndarray) -> dict:
    idx = np.where(np.abs(delta).max(axis=1) > 1e-6)[0]
    d = delta[idx]
    scale = float(np.abs(d).max() / 32767) if len(d) else 1.0
    blob.add(f"{name}.i", idx, "u16")
    blob.add(f"{name}.d", np.round(d / max(scale, 1e-12)).astype(np.int64).reshape(-1), "i16")
    return {"i": f"{name}.i", "d": f"{name}.d", "scale": scale, "count": int(len(idx))}


def seg_dist(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def main():
    os.makedirs(TEX, exist_ok=True)
    print("Malla base…")
    base_path = fetch(f"{GH}/data/3dobjs/base.obj", "base.obj")
    V, VT, faces = parse_obj(base_path)
    n = len(V)
    V = V * DM_TO_M
    groups_v: Dict[str, set] = {}
    for g, corners in faces:
        groups_v.setdefault(g, set()).update(c[0] for c in corners)

    print("Morfos…")
    f_avg = sum(read_target(f"{MACRO}/{e}-female-young", n) for e in ETHNIC) / len(ETHNIC)
    base = V + f_avg
    blob = Blob()
    blob.add("base", base.reshape(-1), "f32")
    params = []
    for name, label, pos, neg, only_pos in PARAMS:
        def delta(rels):
            # Etnia: promedio de las tres, relativo a la mujer base. Peso/músculo: ya son relativos.
            if any("-young" in r and r.rsplit("/", 1)[-1].split("-")[0] in ETHNIC for r in rels):
                return sum(read_target(r, n) for r in rels) / len(rels) - f_avg
            return sum(read_target(r, n) for r in rels)
        entry = {"name": name, "label": label, "min": 0.0 if only_pos else -1.0, "max": 1.0}
        entry["pos"] = sparse(blob, f"{name}+", delta(pos))
        if neg:
            entry["neg"] = sparse(blob, f"{name}-", delta(neg))
        params.append(entry)
    for name, (label, keys) in MEASURE.items():
        inc = sum(read_target(f"data/targets/measure/measure-{k}-incr", n) for k in keys)
        dec = sum(read_target(f"data/targets/measure/measure-{k}-decr", n) for k in keys)
        params.append({"name": name, "label": label, "min": -1.0, "max": 1.0,
                       "pos": sparse(blob, f"{name}+", inc), "neg": sparse(blob, f"{name}-", dec)})

    print("Reglas de medida…")
    src = open(fetch(f"{GH}/plugins/0_modeling_a_measurement.py", "measure.py"), encoding="utf-8").read()
    rulers = {}
    for k in RULERS:
        m = re.search(r"\['measure/measure-" + re.escape(k) + r"-decr\|incr'\]\s*=\s*\[([0-9,\s]+)\]", src)
        if not m:
            raise SystemExit(f"No encontré la regla {k}")
        rulers[k] = [int(x) for x in m.group(1).replace(" ", "").split(",") if x]

    joints = {}
    for j in JOINTS:
        verts = sorted(groups_v.get(f"joint-{j}", []))
        if not verts:
            raise SystemExit(f"Falta la articulación {j}")
        joints[j] = verts

    print("Malla de dibujo…")
    body_map, body_vt, body_tris = split_render(faces, {"body"})
    eye_map, eye_vt, eye_tris = split_render(faces, {"helper-l-eye", "helper-r-eye"})
    if len(body_map) >= 65536:
        raise SystemExit("Demasiados vértices para índices de 16 bits")
    jpos = {j: base[v].mean(axis=0) for j, v in joints.items()}
    P = base[body_map]
    waist_y = base[rulers["waist-circ"]][:, 1].mean()
    bones = {
        "cabeza": ("head", "head-2"), "cuello": ("neck", "head"), "torso": ("spine-3", "neck"), "pelvis": ("pelvis", "spine-2"),
        "brazo": ("shoulder", "elbow"), "antebrazo": ("elbow", "hand"), "mano": ("hand", "finger-3-4"),
        "muslo": ("upper-leg", "knee"), "pierna": ("knee", "ankle"), "pie": ("ankle", "toe-1-3"),
    }
    best = np.full(len(P), np.inf)
    reg = np.zeros(len(P), np.int64)
    for rname, (a, b) in bones.items():
        sides = ("l-", "r-") if rname in ("brazo", "antebrazo", "mano", "muslo", "pierna", "pie") else ("",)
        for s in sides:
            d = seg_dist(P, jpos[s + a], jpos[s + b])
            if rname in ("torso", "pelvis"):
                d = d * 0.75  # el tronco es ancho: gana a los brazos cerca de la axila
            upd = d < best
            best[upd] = d[upd]
            reg[upd] = REGIONS[rname]
    reg[(reg == REGIONS["torso"]) & (P[:, 1] < waist_y)] = REGIONS["pelvis"]
    reg[(reg == REGIONS["pelvis"]) & (P[:, 1] >= waist_y)] = REGIONS["torso"]
    reg[(np.isin(reg, [REGIONS["cuello"], REGIONS["torso"]])) & (P[:, 1] > jpos["head"][1])] = REGIONS["cabeza"]

    blob.add("body.map", body_map, "u16")
    blob.add("body.uv", VT[body_vt].reshape(-1), "f32")
    blob.add("body.idx", body_tris.reshape(-1), "u16")
    blob.add("body.region", reg, "u8")
    blob.add("eyes.map", eye_map, "u16")
    blob.add("eyes.uv", VT[eye_vt].reshape(-1), "f32")
    blob.add("eyes.idx", eye_tris.reshape(-1), "u16")

    print("Pelo, cejas y texturas…")
    proxies = {}
    for key, name in [*HAIR.items(), ("cejas", "eyebrow001"), ("ojos", "low-poly")]:
        texture = None
        if key == "ojos":
            # Globos oculares: proxy propio con sus UVs; la textura se elige por el color de ojos
            base_url = f"{GH}/data/eyes/low-poly"
        else:
            base_url = f"{ASSETS}/" + (f"eyebrows/{name}" if key == "cejas" else f"hair/{name}")
        refs, w, off, scales, objname = parse_mhclo(fetch(f"{base_url}/{name}.mhclo", f"{name}.mhclo"))
        pv, pvt, pfaces = parse_obj(fetch(f"{base_url}/{objname or name + '.obj'}", f"{name}.obj"))
        pmap, pvtmap, ptris = split_render(pfaces)
        if key != "ojos":
            # El nombre de la textura viene en el material (.mhmat), p. ej. afro_diffuse.png
            mat = open(fetch(f"{base_url}/{name}.mhmat", f"{name}.mhmat"), encoding="utf-8", errors="ignore").read()
            found = re.search(r"^diffuseTexture\s+(\S+)", mat, re.M)
            texname = os.path.basename(found.group(1)) if found else f"{name}_diffuse.png"
            texture = f"pelo_{key}.png"
            gray_tint(fetch(f"{base_url}/{texname}", texname), os.path.join(TEX, texture), 256 if key == "cejas" else 512)
        pre = f"proxy.{key}"
        blob.add(f"{pre}.refs", refs.reshape(-1), "u16")
        blob.add(f"{pre}.w", w.reshape(-1), "f32")
        blob.add(f"{pre}.off", off.reshape(-1), "f32")
        blob.add(f"{pre}.map", pmap, "u16")
        blob.add(f"{pre}.uv", pvt[pvtmap].reshape(-1), "f32")
        blob.add(f"{pre}.idx", ptris.reshape(-1), "u16")
        proxies[key] = {"source": name, "scales": {k: [a, b, s * DM_TO_M] for k, (a, b, s) in scales.items()}, "texture": texture}

    skin = cv2.imread(fetch(f"{ASSETS}/skins/textures/young_lightskinned_female_diffuse.png", "piel.png"), cv2.IMREAD_COLOR)
    cv2.imwrite(os.path.join(TEX, "piel_base.png"), cv2.resize(skin, (2048, 2048), interpolation=cv2.INTER_AREA))
    for e in EYES:
        img = cv2.imread(fetch(f"{ASSETS}/eyes/materials/{e}_eye.png", f"{e}_eye.png"), cv2.IMREAD_COLOR)
        cv2.imwrite(os.path.join(TEX, f"ojos_{e}.png"), cv2.resize(img, (256, 256), interpolation=cv2.INTER_AREA))
    # Ojos castaño oscuro: el castaño claro oscurecido (no hay textura propia)
    light = cv2.imread(os.path.join(TEX, "ojos_brownlight.png"))
    hsv = cv2.cvtColor(light, cv2.COLOR_BGR2HSV).astype(np.float64)
    iris = hsv[:, :, 1] > 60
    hsv[:, :, 2] = np.where(iris, hsv[:, :, 2] * 0.45, hsv[:, :, 2])
    cv2.imwrite(os.path.join(TEX, "ojos_brown.png"), cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR))

    header = {
        "version": "humano-1",
        "license": "Malla, morfos y texturas: MakeHuman 1.1 (CC0 1.0)",
        "units": "m",
        "vertexCount": n,
        "params": params,
        "rulers": rulers,
        "joints": joints,
        "regions": REGIONS,
        "proxies": proxies,
        "eyes": ["brown", *EYES],
        "hairStyles": list(HAIR.keys()),
        "arrays": blob.index,
    }
    hdr = json.dumps(header, separators=(",", ":")).encode("utf-8")
    hdr += b" " * ((-len(hdr)) % 4)
    path = os.path.join(OUT, "humano.bhm")
    with open(path, "wb") as f:
        f.write(b"BHM1" + struct.pack("<I", len(hdr)) + hdr)
        for part in blob.parts:
            f.write(part)
    print(f"Listo: {path} ({os.path.getsize(path) / 1e6:.1f} MB), {len(body_map)} vértices de dibujo, {len(body_tris)} triángulos.")




if __name__ == "__main__":
    sys.exit(main())
