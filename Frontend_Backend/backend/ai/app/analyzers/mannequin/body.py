"""HU-023: avatar maniquí sobre MakeHuman (CC0).

Cuerpo de maniquí (5 siluetas base, rostro suavizado, manos finas, hombros caídos), cabello generado por
mechones (largo × textura × flequillo) y ropa básica portable. Portado del prototipo revisado en Penpot
(página «Simulación 3D · Antes y después»).
"""
import math
import os

import numpy as np

from app.analyzers import human_model as hm

M = hm.load()  # lanza HumanModelMissing si falta models/human/humano.bhm (el endpoint usa el modelo anterior)
R = M.regions

# Hombros algo más estrechos que la base en todas las siluetas (los de la referencia caen suaves)
BASE = {"genero": 0.0, "hombros": -0.3, "peso": -0.25, "musculo": -0.25, "piernas": 0.45, "brazo": -0.35,
        "cuello": -0.35, "pantorrilla": -0.2, "muslo": -0.1, "copa": -0.15}
PRESETS = {
    "Rectángulo": {"cintura": 0.45, "cadera": -0.25, "copa": -0.2, "hombros": 0.15},
    "Pera": {"cadera": 0.8, "muslo": 0.6, "hombros": -0.25, "cintura": -0.2, "copa": -0.15},
    "Reloj de arena": {"cintura": -0.8, "cadera": 0.55, "copa": 0.5, "hombros": 0.2},
    "Triángulo invertido": {"hombros": 0.65, "cadera": -0.55, "muslo": -0.4, "copa": 0.2, "musculo": 0.25},
    "Redondo": {"peso": 0.75, "cintura": 0.8, "copa": 0.4, "hombros": 0.15, "muslo": 0.2},
}


def adjacency(idx, n):
    nb = [[] for _ in range(n)]
    for a, b, c in idx:
        nb[a] += [b, c]; nb[b] += [a, c]; nb[c] += [a, b]
    return [np.unique(np.array(x, dtype=np.int64)) for x in nb]


BODY_N = len(M.body_map)
NB = adjacency(M.body_idx, BODY_N)


def lower_arms(P, extra_deg):
    """Gira cada brazo hacia el cuerpo desde el hombro (A-pose de ~48° a ~70°)."""
    P = P.copy()
    reg = M.vert_region
    arm = np.isin(reg, [R["brazo"], R["antebrazo"], R["mano"]])
    for side, sgn in (("l", 1.0), ("r", -1.0)):
        sh = M.joint(P, f"{side}-shoulder")
        mask = arm & (P[:, 0] * sgn > 0)
        # También el borde del torso junto a la axila, para que no quede un pliegue
        torso_edge = np.isin(reg, [R["torso"]]) & (P[:, 0] * sgn > abs(sh[0]) - 0.03) & (P[:, 1] > sh[1] - 0.12)
        mask = mask | torso_edge
        rel = P[mask] - sh
        dist = rel[:, 0] * sgn  # cuánto se aleja del hombro hacia afuera
        w = np.clip((dist + 0.02) / 0.07, 0, 1) ** 1.5
        t = np.radians(extra_deg) * w * sgn
        c, s = np.cos(t), np.sin(t)
        x = rel[:, 0] * c + rel[:, 1] * s
        y = -rel[:, 0] * s + rel[:, 1] * c
        P[mask, 0] = sh[0] + x
        P[mask, 1] = sh[1] + y
    return P


def slim_hands(P, close=0.38, thin=0.85):
    """Manos de maniquí: dedos más juntos y finos. En el marco de cada mano (eje muñeca→dedo medio,
    ancho de la palma y grosor) acerca los dedos al eje y adelgaza, más hacia las puntas."""
    P = P.copy()
    hand = M.vert_region == R["mano"]
    for side in ("l", "r"):
        wrist = M.joint(P, f"{side}-hand")
        tip = M.joint(P, f"{side}-finger-3-4")
        ax = tip - wrist
        length = np.linalg.norm(ax); ax /= length
        mask = hand & (np.sign(P[:, 0]) == np.sign(wrist[0]))
        rel = P[mask] - wrist
        along = rel @ ax
        perp = rel - along[:, None] * ax
        # Ancho de la palma = dirección de mayor dispersión perpendicular al eje
        u, sv, vt = np.linalg.svd(perp - perp.mean(0), full_matrices=False)
        width_dir, thick_dir = vt[0], vt[1]
        w = perp @ width_dir
        t = perp @ thick_dir
        k = np.clip(along / length, 0, 1) ** 0.8  # nada en la muñeca, máximo en las puntas
        w2 = w * (1 - close * k)
        t2 = t * (1 - (1 - thin) * k)
        P[mask] = wrist + along[:, None] * ax + w2[:, None] * width_dir + t2[:, None] * thick_dir
    return P


def _padded(inner):
    """Vecinos de cada vértice interior en una matriz rellena, para suavizar sin bucles en Python."""
    deg = max(len(NB[i]) for i in inner)
    idx = np.zeros((len(inner), deg), np.int64)
    msk = np.zeros((len(inner), deg), bool)
    for r, i in enumerate(inner):
        idx[r, :len(NB[i])] = NB[i]; msk[r, :len(NB[i])] = True
    return idx, msk[:, :, None]


def _relax(P, inner, iters, lams):
    idx, msk = _padded(inner)
    cnt = msk.sum(1)
    for _ in range(iters):
        for lam in lams:
            avg = (P[idx] * msk).sum(1) / cnt
            P[inner] = P[inner] + lam * (avg - P[inner])
    return P


def vertex_normals(P, F):
    n = np.zeros_like(P)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3):
        np.add.at(n, F[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def egg_of(Pb, chin_y):
    """Forma de la cabeza de maniquí: cráneo elíptico arriba y, hacia abajo, una sección que se estrecha
    con suavidad hasta el cuello real (ni punta en el mentón ni escalón)."""
    head = np.where(M.body_region == R["cabeza"])[0]
    H = Pb[head]
    top = H[:, 1].max()
    skull = H[H[:, 1] > chin_y + 0.55 * (top - chin_y)]
    a = np.percentile(np.abs(skull[:, 0]), 96)
    zf, zb = np.percentile(H[:, 2], 99), np.percentile(skull[:, 2], 1)
    c = (zf - zb) / 2 * 0.97
    cy = chin_y + 0.52 * (top - chin_y)
    y_cut = chin_y - 0.02  # parte más estrecha del cuello; más abajo empieza el trapecio
    # A esa altura el cuello puede estar marcado como cuello, cabeza o torso: se mide la sección central
    neck = Pb[np.isin(M.body_region, [R["cuello"], R["cabeza"], R["torso"]]) & (np.abs(Pb[:, 1] - y_cut) < 0.008) & (np.abs(Pb[:, 0]) < 0.09)]
    nz0, nz1 = np.percentile(neck[:, 2], 3), np.percentile(neck[:, 2], 97)
    return dict(cy=cy, cz=(zf + zb) / 2, a=a, c=c, top=top, y_cut=y_cut,
                ncz=(nz0 + nz1) / 2, na=np.percentile(np.abs(neck[:, 0]), 95), nc=(nz1 - nz0) / 2)


def egg_section(E, y):
    """Centro z y radios (x, z) de la cabeza de maniquí a cada altura."""
    up = np.clip((y - E["cy"]) / (E["top"] - E["cy"]), 0, 1)
    k = np.sqrt(np.clip(1 - up ** 2, 0, 1))
    t = np.clip((E["cy"] - y) / (E["cy"] - E["y_cut"]), 0, 1)
    sm = t * t * (3 - 2 * t)
    rx = np.where(y >= E["cy"], E["a"] * k, E["a"] + (E["na"] - E["a"]) * sm)
    rz = np.where(y >= E["cy"], E["c"] * k, E["c"] + (E["nc"] - E["c"]) * sm)
    cz = np.where(y >= E["cy"], E["cz"], E["cz"] + (E["ncz"] - E["cz"]) * sm)
    return cz, np.maximum(rx, 1e-4), np.maximum(rz, 1e-4)


def project_egg(P, E, shrink=None):
    """Lleva cada punto, a su misma altura, al contorno elíptico de la sección."""
    cz, rx, rz = egg_section(E, P[:, 1])
    dx, dz = P[:, 0], P[:, 2] - cz
    rho = np.sqrt((dx / rx) ** 2 + (dz / rz) ** 2) + 1e-12
    f = 1 / rho if shrink is None else shrink / rho
    out = P.copy()
    out[:, 0] = dx * f
    out[:, 2] = cz + dz * f
    return out


def smooth_face(Pb, chin_y):
    """Cabeza de maniquí lisa: sin nariz, boca, ojos ni orejas, unida al cuello sin costura.
    Lo que miraba hacia dentro (boca, cuencas) queda dentro de la cabeza."""
    E = egg_of(Pb, chin_y)
    zone = np.where(np.isin(M.body_region, [R["cabeza"], R["cuello"], R["torso"]]) & (Pb[:, 1] > E["y_cut"]) & (np.abs(Pb[:, 0]) < 0.12))[0]
    zset = set(zone.tolist())
    inner = np.array([i for i in zone if len(NB[i]) and all(int(j) in zset for j in NB[i])])
    N = vertex_normals(Pb, M.body_idx)
    surf = project_egg(Pb[inner], E)
    cz, _, _ = egg_section(E, Pb[inner, 1])
    radial = np.stack([Pb[inner, 0], np.zeros(len(inner)), Pb[inner, 2] - cz], 1)
    facing_in = (N[inner] * radial).sum(1) < 0
    deep = project_egg(Pb[inner], E, shrink=0.8)
    P = Pb.copy()
    P[inner] = np.where(facing_in[:, None], deep, surf)
    return _relax(P, inner, 80, (0.5, -0.53))


FACE_MODE = "suave"  # rostro elegido: original suavizado con nariz más estrecha (opción B)


def face_by_mode(Pb, chin_y):
    """Rostro según el modo: óvalo liso, el original del modelo o el original con rasgos suavizados."""
    if FACE_MODE == "huevo":
        return smooth_face(Pb, chin_y)
    if FACE_MODE == "original":
        return Pb
    # Suave: el mismo rostro con nariz, labios y párpados menos marcados (no borra los rasgos)
    head = np.where(M.body_region == R["cabeza"])[0]
    top = Pb[head, 1].max()
    zone = np.where(np.isin(M.body_region, [R["cabeza"], R["cuello"]]) & (Pb[:, 1] > chin_y - 0.01) & (Pb[:, 1] < top - 0.04))[0]
    zset = set(zone.tolist())
    inner = np.array([i for i in zone if len(NB[i]) and all(int(j) in zset for j in NB[i])])
    P = _relax(Pb.copy(), inner, 12, (0.6, -0.62))
    return narrow_nose(P, chin_y)


def narrow_nose(Pb, chin_y, amount=0.25):
    """Nariz un 25 % más estrecha: acerca a la línea media solo la zona de la nariz, con caída suave."""
    head = np.where(np.isin(M.body_region, [R["cabeza"], R["cuello"]]) & (Pb[:, 1] > chin_y))[0]
    mid = head[np.abs(Pb[head, 0]) < 0.006]
    tip = Pb[mid[np.argmax(Pb[mid, 2])]]
    P = Pb.copy()
    d = P[head]
    wy = np.exp(-((d[:, 1] - (tip[1] + 0.012)) / 0.022) ** 2)       # del puente a la punta
    wz = np.clip((d[:, 2] - (tip[2] - 0.035)) / 0.02, 0, 1)          # solo lo que sobresale de la cara
    wx = np.exp(-(d[:, 0] / 0.028) ** 2)                              # cerca de la línea media
    w = wy * wz * wx
    P[head, 0] = d[:, 0] * (1 - amount * w)
    return P


def eyes_by_mode(P_full, Pb, chin_y):
    if FACE_MODE == "huevo":
        return egg_eyes(P_full, Pb, chin_y)
    return P_full[M.arr("eyes.map")], M.arr("eyes.idx").reshape(-1, 3).astype(np.int64)


def egg_eyes(P_full, Pb, chin_y):
    """Los ojos tapan los huecos de las cuencas: se proyectan a la superficie de la cabeza."""
    E = egg_of(Pb, chin_y)
    pts = project_egg(P_full[M.arr("eyes.map")], E, shrink=0.995)
    return pts, M.arr("eyes.idx").reshape(-1, 3).astype(np.int64)


def smooth_body(Pb, iters=8):
    """Superficie de porcelana: quita rodillas, codos y clavículas marcadas sin tocar manos ni pies."""
    zone = np.where(np.isin(M.body_region, [R["brazo"], R["antebrazo"], R["mano"], R["muslo"], R["pierna"]]))[0]
    zs = set(zone.tolist())
    inner = np.array([i for i in zone if len(NB[i]) and all(int(j) in zs for j in NB[i])])
    return _relax(Pb.copy(), inner, iters, (0.5, -0.53))


def smooth_trunk(Pb, iters=25):
    """Superficie de maniquí: suaviza cuello, tronco y pelvis (pezones, ombligo, pubis) sin encoger (Taubin).
    El cuello va en la misma pasada que el tronco: suavizados por separado dejaban un «collar» en la nuca."""
    zone = np.where(np.isin(M.body_region, [R["cuello"], R["torso"], R["pelvis"]]))[0]
    zs = set(zone.tolist())
    inner = np.array([i for i in zone if len(NB[i]) and all(int(j) in zs for j in NB[i])])
    return _relax(Pb.copy(), inner, iters, (0.5, -0.53))


HAIR_COL = np.array([52, 38, 30], float)
_N_ORIG = int(M.body_map.max()) + 1
_DUP_COUNT = np.bincount(M.body_map, minlength=_N_ORIG).astype(float)


def weld(Pb):
    """La malla de dibujo repite vértices en las costuras de la textura: tras suavizar, cada copia queda en
    un sitio distinto y se abre una grieta (el «collar» de la nuca). Se promedian las copias."""
    acc = np.zeros((_N_ORIG, 3))
    np.add.at(acc, M.body_map, Pb)
    return (acc / np.maximum(_DUP_COUNT, 1)[:, None])[M.body_map]


def afro_volume(P, body):
    """Afro estilizado: un volumen redondo alrededor del cráneo con rizos suaves, abierto en un óvalo para la
    cara y que baja por los lados y la nuca hasta la altura de las orejas."""
    head = np.where(M.body_region == R["cabeza"])[0]
    H = body[head]
    top = H[:, 1].max()
    le = M.joint(P, "l-eye")
    skull_half = np.percentile(np.abs(H[:, 0]), 90)
    zb, zf = H[:, 2].min(), H[:, 2].max()
    cx, cy, cz = 0.0, le[1] + 0.03, (zb + zf) / 2 - 0.012
    ax, ay, az = skull_half + 0.04, (top - cy) + 0.035, (zf - zb) / 2 + 0.02
    nu, nv = 64, 40
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    v = np.linspace(0, np.pi, nv)
    uu, vv = np.meshgrid(u, v)
    dx, dy, dz = np.sin(vv) * np.sin(uu), np.cos(vv), np.sin(vv) * np.cos(uu)
    bump = 1 + 0.03 * np.sin(9 * uu) * np.sin(7 * vv) + 0.015 * np.sin(17 * uu + 1) * np.sin(13 * vv)
    V = np.stack([cx + ax * dx * bump, cy + ay * dy * bump, cz + az * dz * bump], -1).reshape(-1, 3)
    F = []
    for i in range(nv - 1):
        for j in range(nu):
            a0, a1 = i * nu + j, i * nu + (j + 1) % nu
            b0, b1 = (i + 1) * nu + j, (i + 1) * nu + (j + 1) % nu
            F += [(a0, b0, a1), (a1, b0, b1)]
    F = np.array(F)
    # Óvalo de la cara: delante y por debajo del nacimiento del pelo (frente)
    # Óvalo de la cara (borde redondeado, sin esquinas): centrado un poco bajo los ojos
    oy = le[1] - 0.015
    face = (V[:, 2] > cz) & (((V[:, 0]) / (skull_half * 0.92)) ** 2 + ((V[:, 1] - oy) / 0.075) ** 2 < 1)
    low = V[:, 1] < le[1] - 0.045  # hasta la altura de las orejas
    keep_v = ~face & ~low
    F = F[keep_v[F].all(1)]
    return V, F


def _nearest(A, B, chunk=600):
    """Para cada punto de A: distancia al punto más cercano de B."""
    d = np.full(len(A), np.inf)
    for i in range(0, len(B), chunk):
        d = np.minimum(d, np.linalg.norm(A[:, None, :] - B[None, i:i + chunk], axis=2).min(1))
    return d


def lock_colors(hp, hidx, base_col, root_y):
    """Mechones esculpidos: cada tira del peinado (componente conexa) con su propio tono y un degradado de la
    raíz (más oscura) a la punta (más clara), como en las referencias."""
    n = len(hp)
    parent = np.arange(n)
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for a, b, c in hidx:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra; parent[rc] = ra
    comp = np.array([find(i) for i in range(n)])
    _, comp = np.unique(comp, return_inverse=True)
    rng = np.random.default_rng(7)
    tone = rng.uniform(0.78, 1.18, comp.max() + 1)
    # Degradado por altura: raíz arriba más oscura, puntas más claras
    y = hp[:, 1]
    t = np.clip((root_y - y) / max(root_y - y.min(), 1e-3), 0, 1)
    shade = (0.82 + 0.38 * t) * tone[comp]
    vcol = np.clip(base_col[None, :] * shade[:, None], 0, 255)
    return vcol[hidx].mean(1)  # color por triángulo


def generated_hair(P, body, key):
    """Peinado del generador de mechones: key = gen:<corto|medio|largo>:<lacio|ondulado>:<fleco|sin>."""
    from . import hairgen
    _, length, texture, fr = key.split(":")
    chin = hm.face_keypoints(M, P)["barbilla"][1]
    E = egg_of(body, chin)
    le = M.joint(P, "l-eye")
    head = hairgen.Head((0.0, E["cy"], E["cz"]), E["a"], E["top"] - E["cy"], E["c"], le[1] + 0.022, chin,
                        M.joint(P, "l-shoulder")[1])
    keep = np.isin(M.body_region, [R["torso"], R["cuello"], R["pelvis"], R["cabeza"]])  # sin brazos
    body_r = hairgen.BodyRadius(body[keep], E["ncz"], 0.4, E["top"] + 0.05)
    V, F, sh = hairgen.generate(head, body_r, length, texture == "ondulado", fr == "fleco")
    cols = np.clip(HAIR_COL[None, :] * sh[:, None], 0, 255)
    # Portable: ~6 mil caras. Color por vértice (media de sus caras) y, tras simplificar, del vértice más cercano
    target = 6000
    try:
        import fast_simplification as fsim  # opcional: si no está instalado se usa la malla tal cual
    except ImportError:
        fsim = None
    if fsim is not None and len(F) > target:
        vc = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
        np.add.at(vc, F.reshape(-1), np.repeat(cols, 3, axis=0)); np.add.at(cnt, F.reshape(-1), 1)
        vc /= np.maximum(cnt, 1)[:, None]
        V2, F2 = fsim.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=1 - target / len(F))
        vc2 = np.zeros((len(V2), 3))
        for i0 in range(0, len(V2), 400):
            d = ((V2[i0:i0 + 400, None, :] - V[None, :, :]) ** 2).sum(2)
            vc2[i0:i0 + 400] = vc[d.argmin(1)]
        V, F, cols = V2.astype(float), F2, vc2[F2].mean(1)
    # Base pegada al cuero cabelludo bajo los mechones (sin cara ni orejas)
    N = vertex_normals(body, M.body_idx)
    cand = np.where(np.isin(M.body_region, [R["cabeza"], R["cuello"]]))[0]
    near = _nearest(body[cand], V[::3])
    covered = np.zeros(len(body), bool); covered[cand[near < 0.03]] = True
    face_top = le[1] + (0.022 if fr == "fleco" else 0.06)
    covered &= ~((body[:, 2] > le[2] - 0.035) & (body[:, 1] < face_top) & (body[:, 1] > chin - 0.01))
    skull_half = np.percentile(np.abs(body[np.where(M.body_region == R["cabeza"])[0], 0]), 90)
    covered &= ~((np.abs(body[:, 0]) > skull_half * 0.92) & (body[:, 1] < le[1] + 0.025) & (body[:, 1] > chin))
    covered &= body[:, 1] > chin - 0.02
    tris = M.body_idx[covered[M.body_idx].all(1)]
    return [(body + N * 0.003, tris, HAIR_COL * 0.8, False), (V, F, cols, False)]


def hair_layers(P, body, hair_key):
    if hair_key and hair_key.startswith("gen:"):
        return generated_hair(P, body, hair_key)
    """Pelo como capas: los mechones de MakeHuman (tienen transparencia y, opacos, dejan huecos) más una
    base sólida pegada al cuero cabelludo. El afro se reemplaza por un volumen liso que lo envuelve."""
    res = M.proxy(P, hair_key) if hair_key else None
    if res is None:
        return []
    hp, _, hidx = res
    F = M.body_idx
    N = vertex_normals(body, F)
    cand = np.where(np.isin(M.body_region, [R["cabeza"], R["cuello"]]))[0]
    reach = 0.05 if hair_key == "afro" else 0.022
    near = _nearest(body[cand], hp)
    covered = np.zeros(len(body), bool)
    covered[cand[near < reach]] = True
    # El rostro nunca se cubre (el flequillo del bob sí cae por delante: son sus mechones, no la base)
    chin = hm.face_keypoints(M, P)["barbilla"][1]
    le = M.joint(P, "l-eye")
    # Con flequillo (bob, largo) la frente queda bajo el pelo: la base llega hasta la línea de las cejas
    face_top = le[1] + (0.022 if hair_key in ("bob", "largo") else 0.035)
    face = (body[:, 2] > le[2] - 0.035) & (body[:, 1] < face_top) & (body[:, 1] > chin - 0.01)
    covered &= ~face
    # Orejas: a la altura de los ojos y por fuera del cráneo; se dejan a la vista
    skull_half = np.percentile(np.abs(body[np.where(M.body_region == R["cabeza"])[0], 0]), 90)
    ears = (np.abs(body[:, 0]) > skull_half * 0.92) & (body[:, 1] < le[1] + 0.025) & (body[:, 1] > chin)
    covered &= ~ears
    tris = F[covered[F].all(1)]
    if hair_key == "afro":
        V, Fa = afro_volume(P, body)
        return [(body + N * 0.003, tris, HAIR_COL * 0.85, False), (V, Fa, HAIR_COL, False)]
    base = body + N * 0.003
    if hair_key in ("corto", "coleta"):  # el largo y el bob tienen flequillo a propósito
        # Flequillo deshilachado (mechones pensados con transparencia): se quitan los que caen sobre la frente
        oy = le[1] + 0.005
        in_face = (hp[:, 2] > le[2] - 0.03) & ((hp[:, 0] / (skull_half * 0.95)) ** 2 + ((hp[:, 1] - oy) / 0.05) ** 2 < 1)
        hidx = hidx[~in_face[hidx].any(1)]
    if hair_key in ("bob", "largo"):
        # Flequillo recto sobre las cejas (como la referencia): lo que cae por delante de la cara por debajo
        # de esa línea se sube hasta ella, sin quitar mechones
        hp = hp.copy()
        brow = le[1] + 0.022
        front = (hp[:, 2] > le[2] - 0.025) & (np.abs(hp[:, 0]) < skull_half * 0.82)
        low = front & (hp[:, 1] < brow)
        k = np.clip((brow - hp[low, 1]) / 0.06, 0, 1)
        hp[low, 1] = brow - 0.004 * (1 - k)
        hp[low, 2] = hp[low, 2] + 0.004  # que no se meta en la frente
    top = body[np.where(M.body_region == R["cabeza"])[0], 1].max()
    return [(base, tris, HAIR_COL * 0.8, False), (hp, hidx, lock_colors(hp, hidx, HAIR_COL, top), False)]


def build(preset, hair_key):
    params = dict(BASE)
    for k, v in PRESETS[preset].items():
        params[k] = params.get(k, 0.0) + v
    P = M.apply(params)
    lo, hi = M.bounds(P)
    P = (P - [0, lo, 0]) * (1.68 / (hi - lo))
    P = slim_hands(lower_arms(P, 22.0))
    body = weld(smooth_body(weld(smooth_trunk(weld(face_by_mode(P[M.body_map], hm.face_keypoints(M, P)["barbilla"][1]))))))
    parts = [(body, M.body_idx, np.array([236, 234, 232], float), True)]
    ep, ei = eyes_by_mode(P, body, hm.face_keypoints(M, P)["barbilla"][1])
    parts.append((ep, ei, np.array([236, 234, 232], float), True))
    parts += hair_layers(P, body, hair_key)
    return parts


