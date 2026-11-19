"""Ropa básica portable generada sobre el maniquí (estándar: tela con grosor en los bordes, sin atravesar el cuerpo).

Prendas: camiseta, blusa_v, top, blazer, pantalon_recto, pantalon_ancho, falda_a, falda_lapiz, vestido."""
import numpy as np

PALETA = {
    # Sin blanco puro: sobre el maniquí blanco no se ve. «crema» es el claro estándar
    "crema": (226, 212, 186), "negro": (43, 43, 46), "beige": (203, 184, 157), "marino": (47, 58, 86),
    "salvia": (157, 176, 154), "terracota": (182, 106, 80), "celeste": (169, 194, 222),
}


class Body:
    def __init__(self, P, F, region, R, joint, waist_y, orig):
        self.P, self.F, self.reg, self.R, self.orig = P, F, region, R, orig
        self.N = self._normals()
        self.j = joint
        sh = (joint("l-shoulder") + joint("r-shoulder")) / 2
        self.shoulder_y = sh[1]
        self.waist_y = waist_y
        self.hip_y = joint("pelvis")[1]
        self.crotch_y = joint("l-upper-leg")[1] - 0.08
        self.knee_y = joint("l-knee")[1]
        self.ankle_y = joint("l-ankle")[1]
        neck = P[np.isin(region, [R["cuello"]])]
        self.neck_z = (neck[:, 2].min() + neck[:, 2].max()) / 2
        self.neck_r = np.percentile(np.abs(neck[:, 0]), 95)
        trunk = P[np.isin(region, [R["torso"], R["pelvis"]])]
        self.zc = (trunk[:, 2].min() + trunk[:, 2].max()) / 2

    def _normals(self):
        n = np.zeros_like(self.P)
        fn = np.cross(self.P[self.F[:, 1]] - self.P[self.F[:, 0]], self.P[self.F[:, 2]] - self.P[self.F[:, 0]])
        for k in range(3):
            np.add.at(n, self.F[:, k], fn)
        return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

    def mask(self, *names):
        return np.isin(self.reg, [self.R[n] for n in names])


def _rim(V, F, depth):
    """Borde con grosor: una tira hacia dentro en cada arista de borde (el dobladillo que se ve en las referencias)."""
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    uniq, cnt = np.unique(e, axis=0, return_counts=True)
    border = uniq[cnt == 1]
    if not len(border):
        return V, F
    n = len(V)
    vb = np.unique(border)
    idx = -np.ones(n, int); idx[vb] = n + np.arange(len(vb))
    Vin = V[vb] + depth[vb] if depth.ndim == 2 else V[vb]
    newF = [np.stack([border[:, 0], border[:, 1], idx[border[:, 1]]], 1), np.stack([border[:, 0], idx[border[:, 1]], idx[border[:, 0]]], 1)]
    return np.vstack([V, Vin]), np.vstack([F] + newF)


def shell(b, sel, offset, rim=0.005):
    """Prenda ceñida: los triángulos del cuerpo seleccionados, separados `offset` por la normal, con dobladillo."""
    tris = b.F[sel[b.F].all(1)]
    # Se trabaja con los vértices originales (sin las copias de las costuras de textura): si no, cada costura
    # contaría como borde y saldría un dobladillo por dentro de la prenda
    to = b.orig[tris]
    used = np.unique(to)
    first = np.zeros(b.orig.max() + 1, int); first[b.orig[::-1]] = np.arange(len(b.orig))[::-1]
    remap = -np.ones(b.orig.max() + 1, int); remap[used] = np.arange(len(used))
    src = first[used]
    V = b.P[src] + b.N[src] * offset
    F = remap[to]
    return _rim(V, F, -b.N[src] * rim)


def neckline(b, kind="redondo", depth=0.12, width=0.04):
    """Máscara de lo que la prenda NO cubre en el cuello (redondo o en V)."""
    P = b.P
    d = np.hypot(P[:, 0], P[:, 2] - b.neck_z)
    out = b.mask("cuello") | ((P[:, 1] > b.shoulder_y - 0.035) & (d < b.neck_r + 0.03))
    if kind == "v":
        y0 = b.shoulder_y - depth
        t = np.clip((P[:, 1] - y0) / (b.shoulder_y - y0), 0, 1)
        out |= (P[:, 2] > b.zc) & (P[:, 1] > y0) & (np.abs(P[:, 0]) < width * t + 0.004)
    return out


def sleeve(b, length):
    """Vértices del brazo hasta `length` metros desde el hombro (0 = sin manga)."""
    arm = b.mask("brazo", "antebrazo", "mano")
    keep = np.zeros(len(b.P), bool)
    if length <= 0:
        return keep
    for side in ("l", "r"):
        sh, el = b.j(f"{side}-shoulder"), b.j(f"{side}-elbow")
        ax = (el - sh) / np.linalg.norm(el - sh)
        s = (b.P - sh) @ ax
        wrist = (b.j(f"{side}-hand") - sh) @ ax - 0.03  # nunca pasa de la muñeca
        keep |= arm & (np.sign(b.P[:, 0]) == np.sign(sh[0])) & (s < min(length, wrist))
    return keep


def rings(b, sel_fn, y_top, y_bot, flare, ease, n_rings=12, seg=32, center=None, monotonic_from=None):
    """Pieza con vuelo (falda, pernera): anillos que siguen el contorno del cuerpo ángulo a ángulo."""
    P = b.P
    cx, cz = center if center is not None else (0.0, b.zc)
    ys = np.linspace(y_top, y_bot, n_rings)
    band = max(0.012, (y_top - y_bot) / n_rings)
    radii, prev = [], None
    for k, y in enumerate(ys):
        m = sel_fn(y, band)
        r = np.zeros(seg)
        if m.any():
            dx, dz = P[m, 0] - cx, P[m, 2] - cz
            s = ((np.arctan2(dz, dx) % (2 * np.pi)) / (2 * np.pi) * seg).astype(int) % seg
            np.maximum.at(r, s, np.hypot(dx, dz))
        for _ in range(3):
            r = np.where(r > 0, r, np.maximum(np.roll(r, 1), np.roll(r, -1)))
        r = np.maximum(r, (np.roll(r, 1) + np.roll(r, -1)) / 2)
        if prev is not None and (monotonic_from is None or y < monotonic_from):
            r = np.maximum(r, prev)
        prev = r.copy()
        t = k / (n_rings - 1)
        radii.append(r * (1 + flare * t ** 1.3) + ease)
    ang = (np.arange(seg) + 0.5) / seg * 2 * np.pi
    V = np.array([[cx + np.cos(a) * radii[i][j], ys[i], cz + np.sin(a) * radii[i][j]] for i in range(n_rings) for j, a in enumerate(ang)])
    F = []
    for i in range(n_rings - 1):
        for j in range(seg):
            a0, a1 = i * seg + j, i * seg + (j + 1) % seg
            F += [(a0, a0 + seg, a1), (a1, a0 + seg, a1 + seg)]
    F = np.array(F)
    # Dobladillo: hacia el eje
    cen = np.stack([np.full(len(V), cx), V[:, 1], np.full(len(V), cz)], 1)
    inward = (cen - V); inward /= np.linalg.norm(inward, axis=1, keepdims=True) + 1e-9
    return _rim(V, F, inward * 0.005)


def _legs_fn(b, side=None):
    legs = b.mask("muslo", "pierna", "pelvis", "torso")
    def fn(y, band):
        m = legs & (np.abs(b.P[:, 1] - y) < band)
        if side is not None:
            m &= np.sign(b.P[:, 0]) == side
        return m
    return fn


def make(b, kind):
    """Devuelve (V, F) de una prenda básica."""
    P = b.P
    if kind in ("camiseta", "blusa_v", "blusa_basica", "top", "blazer"):
        hem = {"camiseta": b.hip_y + 0.03, "blusa_v": b.hip_y + 0.0, "blusa_basica": b.hip_y + 0.02, "top": b.waist_y - 0.04, "blazer": b.hip_y - 0.05}[kind]
        sl = {"camiseta": 0.13, "blusa_v": 0.62, "blusa_basica": 0.13, "top": 0.0, "blazer": 0.6}[kind]
        sel = (b.mask("torso", "pelvis") & (P[:, 1] >= hem)) | sleeve(b, sl)
        sel &= ~neckline(b, "v" if kind in ("blusa_v", "blusa_basica", "blazer") else "redondo", depth=0.2 if kind == "blazer" else 0.12, width=0.06 if kind == "blazer" else 0.04)
        if kind == "blazer":
            sel &= ~((P[:, 2] > b.zc) & (np.abs(P[:, 0]) < 0.03))  # abierto por delante
        return shell(b, sel, 0.016 if kind == "blazer" else 0.006)
    if kind in ("falda_a", "falda_lapiz"):
        hem = b.knee_y + 0.06
        return rings(b, _legs_fn(b), b.waist_y, hem, 0.32 if kind == "falda_a" else 0.0, 0.006, monotonic_from=b.hip_y)
    if kind in ("pantalon_recto", "pantalon_ancho", "short"):
        # Cadera, glúteos y parte alta del muslo: se solapa con las perneras para que no quede hueco
        top = shell(b, b.mask("pelvis", "muslo") & (P[:, 1] <= b.waist_y) & (P[:, 1] >= b.crotch_y - 0.06), 0.007)
        parts = [top]
        for side in (1, -1):
            leg = b.mask("muslo", "pierna") & (np.sign(P[:, 0]) == side)
            c = P[leg & (np.abs(P[:, 1] - b.knee_y) < 0.03)]
            cx, cz = c[:, 0].mean(), c[:, 2].mean()
            fn = lambda y, band, s=side: b.mask("muslo", "pierna") & (np.sign(P[:, 0]) == s) & (np.abs(P[:, 1] - y) < band)
            hem = b.crotch_y - 0.13 if kind == "short" else b.ankle_y + 0.03  # short: a medio muslo
            parts.append(rings(b, fn, b.crotch_y + 0.02, hem, 0.55 if kind == "pantalon_ancho" else (0.06 if kind == "short" else 0.0), 0.008,
                               n_rings=5 if kind == "short" else 14, seg=20, center=(cx, cz), monotonic_from=b.knee_y + 0.08))
        return merge(parts)
    if kind == "vestido":
        bodice = shell(b, b.mask("torso", "pelvis") & (P[:, 1] >= b.waist_y - 0.02) & ~neckline(b, "redondo"), 0.006)
        skirt = rings(b, _legs_fn(b), b.waist_y, b.knee_y + 0.03, 0.3, 0.007, monotonic_from=b.hip_y)
        return merge([bodice, skirt])
    raise ValueError(kind)


def merge(parts):
    Vs, Fs, off = [], [], 0
    for V, F in parts:
        Vs.append(V); Fs.append(F + off); off += len(V)
    return np.vstack(Vs), np.vstack(Fs)
