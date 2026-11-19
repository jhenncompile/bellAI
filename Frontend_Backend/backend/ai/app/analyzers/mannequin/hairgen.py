"""Generador de cabello por mechones esculpidos (estilo de las referencias): largo × textura × flequillo.

Cada mechón es un tubo aplanado que nace en el cuero cabelludo, se peina sobre el cráneo (elipsoide medido de
la cabeza), cae por gravedad y se aparta del cuello, los hombros y la espalda (tabla radial del cuerpo)."""
import math

import numpy as np

LENGTHS = {"corto": "mandíbula", "medio": "hombros", "largo": "media espalda"}


class Head:
    def __init__(self, center, a, b, c, brow_y, chin_y, shoulder_y):
        self.center = np.asarray(center, float)
        self.a, self.b, self.c = a, b, c
        self.brow_y, self.chin_y, self.shoulder_y = brow_y, chin_y, shoulder_y

    def point(self, theta, elev, grow=0.0):
        """Punto del elipsoide del cráneo: theta 0 = frente (+z), 90° = izquierda (+x); elev desde el ecuador."""
        ce, se = np.cos(elev), np.sin(elev)
        return self.center + np.array([(self.a + grow) * ce * np.sin(theta), (self.b + grow) * se, (self.c + grow) * ce * np.cos(theta)])


class BodyRadius:
    """Distancia máxima del cuerpo al eje vertical, por altura y ángulo (para que el pelo no lo atraviese)."""

    def __init__(self, pts, axis_z, y0, y1, step=0.01, sectors=48):
        self.axis_z, self.y0, self.step, self.sectors = axis_z, y0, step, sectors
        n = int((y1 - y0) / step) + 1
        self.r = np.zeros((n, sectors))
        rel = pts - [0, 0, axis_z]
        th = np.arctan2(rel[:, 0], rel[:, 2]) % (2 * np.pi)
        s = (th / (2 * np.pi) * sectors).astype(int) % sectors
        yi = ((pts[:, 1] - y0) / step).astype(int)
        ok = (yi >= 0) & (yi < n)
        d = np.hypot(rel[:, 0], rel[:, 2])
        np.maximum.at(self.r, (yi[ok], s[ok]), d[ok])
        # Sectores vacíos: el máximo de los vecinos (dos pasadas)
        for _ in range(2):
            self.r = np.maximum(self.r, np.maximum(np.roll(self.r, 1, 1), np.roll(self.r, -1, 1)) * (self.r == 0))

    def at(self, y, theta):
        yi = int(np.clip((y - self.y0) / self.step, 0, len(self.r) - 1))
        s = int((theta % (2 * np.pi)) / (2 * np.pi) * self.sectors) % self.sectors
        return max(self.r[yi, s], self.r[yi, (s + 1) % self.sectors], self.r[yi, s - 1])


def _end_y(head, length):
    return {"corto": head.chin_y + 0.015, "medio": head.shoulder_y + 0.035, "largo": head.shoulder_y - 0.24}[length]


def lock_path(head, body, theta0, elev0, length, wavy, fringe_lock, layer, rng, part_side):
    """Recorrido de un mechón (puntos en metros)."""
    grow = 0.008 + 0.006 * layer
    pts = []
    if fringe_lock:
        # Flequillo: se peina hacia delante sobre la frente y se corta recto sobre las cejas
        for e in np.linspace(elev0, -0.2, 14):
            p = head.point(theta0, e, grow + 0.004)
            if p[1] <= head.brow_y + 0.006:
                p[1] = head.brow_y + 0.006
                pts.append(p)
                break
            pts.append(p)
        return np.array(pts)
    # Raya al medio: los mechones de delante se peinan hacia el lado de su raya mientras bajan por el cráneo
    front = abs(math.degrees(theta0)) < 75
    e_fall = -0.12
    elevs = np.linspace(elev0, e_fall, 6)
    for i, e in enumerate(elevs):
        k = i / (len(elevs) - 1)
        th = theta0
        if front:
            target = part_side * math.radians(100)
            th = theta0 + (target - theta0) * (k ** 0.8)
        pts.append(head.point(th, e, grow))
    th_fall = th
    # Caída: en vertical, los mechones laterales y de atrás pasan por detrás de los hombros
    if abs(math.degrees(th_fall)) < 115 and length != "corto":
        th_target = th_fall if abs(math.degrees(th_fall)) < 60 else np.sign(th_fall) * math.radians(135)
    else:
        th_target = th_fall
    y_end = _end_y(head, length) + rng.uniform(-0.01, 0.01)
    start = pts[-1].copy()
    r0 = math.hypot(start[0], start[2] - body.axis_z)
    n_fall = max(3, int((start[1] - y_end) / 0.035))
    amp = 0.012 if wavy else 0.0
    phase = rng.uniform(0, 2 * np.pi)
    lam = 0.075
    for j in range(1, n_fall + 1):
        t = j / n_fall
        y = start[1] + (y_end - start[1]) * t
        th = th_fall + (th_target - th_fall) * min(1.0, t * 2.2)
        drop = start[1] - y
        r = max(r0 + 0.006 * min(drop / 0.1, 1.0), body.at(y, th) + 0.014 + 0.006 * layer)
        r = min(r, r0 + 0.07)  # nunca se aleja tanto de la cabeza (evita hebras sueltas hacia los brazos)
        if wavy:
            # Ondas: desplazamiento lateral que crece hacia la punta
            w = amp * min(1.0, drop / 0.05) * math.sin(2 * math.pi * drop / lam + phase)
            th += w / max(r, 0.05)
            r += 0.4 * amp * min(1.0, drop / 0.05) * math.cos(2 * math.pi * drop / lam + phase)
        pts.append(np.array([r * math.sin(th), y, body.axis_z + r * math.cos(th)]))
    return np.array(pts)


def tube(path, width, thick, center, taper=0.5, sides=6):
    """Tubo aplanado a lo largo del recorrido; ancho en el sentido del cráneo, grosor hacia fuera."""
    n = len(path)
    if n < 2:
        return np.zeros((0, 3)), np.zeros((0, 3), int)
    T = np.gradient(path, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    out = path - center
    out[:, 1] *= 0.3  # «hacia fuera» casi horizontal en la caída
    N = out - (out * T).sum(1, keepdims=True) * T
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    B = np.cross(T, N)
    s = np.linspace(0, 1, n)
    wscale = 1 - taper * s ** 3
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    V = (path[:, None, :]
         + np.cos(ang)[None, :, None] * (width * 0.5 * wscale)[:, None, None] * B[:, None, :]
         + np.sin(ang)[None, :, None] * (thick * 0.5 * wscale)[:, None, None] * N[:, None, :]).reshape(-1, 3)
    F = []
    for i in range(n - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            c, d = a + sides, b + sides
            F += [(a, c, b), (b, c, d)]
    # Tapa en la punta
    tip = (n - 1) * sides
    for k in range(1, sides - 1):
        F.append((tip, tip + k, tip + k + 1))
    return V, np.array(F)


def generate(head, body, length="medio", wavy=False, fringe=False, seed=3):
    """Devuelve (vértices, triángulos, color_por_triángulo_relativo) del peinado."""
    rng = np.random.default_rng(seed)
    Vs, Fs, shade = [], [], []
    off = 0
    n_az = 22
    for layer, elev_rows in ((0, (1.2, 0.85, 0.5, 0.18)), (1, (1.0, 0.65, 0.3))):
        for e0 in elev_rows:
            for k in range(n_az):
                theta = (k + 0.5 * layer) / n_az * 2 * np.pi - np.pi
                deg = abs(math.degrees(theta))
                # Nacimiento del pelo: más alto en la frente, bajo en la nuca
                e_min = 0.62 * max(0.0, math.cos(theta)) - 0.15 * max(0.0, -math.cos(theta))
                if e0 < e_min:
                    continue
                fringe_lock = fringe and deg < 50 and e0 > 0.6 and layer == 1
                # Sin flequillo, la fila más alta del frente no se dibuja en la raya
                if not fringe and deg < 6 and e0 > 1.0:
                    continue
                part_side = 1.0 if theta >= 0 else -1.0
                path = lock_path(head, body, theta, e0, length, wavy, fringe_lock, layer, rng, part_side)
                width = (0.05 if layer == 0 else 0.044) * (1.0 - 0.15 * (e0 > 1.0))
                if fringe_lock:
                    width = 0.024
                V, F = tube(path, width, 0.011, head.center, taper=0.15 if (length == "corto" or fringe_lock) else 0.55, sides=4)
                if not len(F):
                    continue
                Vs.append(V); Fs.append(F + off); off += len(V)
                # Tono por mechón y degradado raíz→punta
                tone = rng.uniform(0.8, 1.15)
                ring = np.repeat(np.linspace(0, 1, len(path)), 4)
                vshade = tone * (0.82 + 0.38 * ring)
                fsh = vshade[F.clip(max=len(vshade) - 1)].mean(1)
                shade.append(fsh)
    return np.vstack(Vs), np.vstack(Fs), np.concatenate(shade)
