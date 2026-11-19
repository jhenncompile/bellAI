/**
 * Color de prendas en el teléfono, con el mismo criterio que el servidor (backend/ai/app/analyzers/garment_color.py):
 * - Paleta de 40 nombres idéntica a la del servidor: una prenda se llama igual en línea y sin conexión.
 * - Nombre por CIEDE2000, que pondera tono y croma como el ojo. Con distancia RGB un denim oscuro
 *   salía «gris» y cualquier gris azulado oscuro salía «azul marino».
 * - Corrección de la luz a partir de un fondo liso y neutro (pared, sábana, papel): si el fondo
 *   blanco sale amarillento, la prenda también, y se compensa.
 * - Agrupación por tono (la luminosidad pesa la mitad) y unión de grupos que el ojo ve iguales:
 *   la sombra de un pliegue no es «otro color».
 */

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

export interface PaletteColor {
  name: string;
  hex: string;
}

export const GARMENT_PALETTE: PaletteColor[] = [
  { name: 'Negro', hex: '#141414' },
  { name: 'Blanco', hex: '#F5F5F2' },
  { name: 'Crema', hex: '#F0E4CC' },
  { name: 'Beige', hex: '#D7C2A1' },
  { name: 'Camel', hex: '#B98B5B' },
  { name: 'Caqui', hex: '#A89A6C' },
  { name: 'Marrón', hex: '#6B4423' },
  { name: 'Chocolate', hex: '#3E2416' },
  { name: 'Gris claro', hex: '#C6C6C6' },
  { name: 'Gris', hex: '#8A8A8A' },
  { name: 'Gris oscuro', hex: '#474747' },
  { name: 'Gris topo', hex: '#8B7D72' },
  { name: 'Rojo', hex: '#C21E2B' },
  { name: 'Vino', hex: '#6B1A30' },
  { name: 'Rosa', hex: '#EC6A9A' },
  { name: 'Rosa pastel', hex: '#F6C1CF' },
  { name: 'Rosa palo', hex: '#D9A7A4' },
  { name: 'Nude', hex: '#E2B9A0' },
  { name: 'Fucsia', hex: '#D3197A' },
  { name: 'Coral', hex: '#F2785F' },
  { name: 'Salmón', hex: '#F39A86' },
  { name: 'Durazno', hex: '#F7C09A' },
  { name: 'Naranja', hex: '#EE7A1A' },
  { name: 'Terracota', hex: '#B4532F' },
  { name: 'Mostaza', hex: '#C9A227' },
  { name: 'Amarillo', hex: '#F5CC1F' },
  { name: 'Verde oliva', hex: '#6B6F2E' },
  { name: 'Verde militar', hex: '#4B5320' },
  { name: 'Verde', hex: '#2F8F3A' },
  { name: 'Verde menta', hex: '#A6E3C6' },
  { name: 'Esmeralda', hex: '#0C7A55' },
  { name: 'Azul petróleo', hex: '#1C5E6B' },
  { name: 'Turquesa', hex: '#26B5B0' },
  { name: 'Celeste', hex: '#8CC4E8' },
  { name: 'Azul', hex: '#2457B8' },
  { name: 'Azul marino', hex: '#1D2742' },
  { name: 'Denim', hex: '#3E5C86' },
  { name: 'Lila', hex: '#BFA4D8' },
  { name: 'Lavanda', hex: '#C8BFE7' },
  { name: 'Morado', hex: '#66308F' },
];

/** Dispersión (en ΔE00) con que aparece un mismo color real en fotos: igual que el servidor. */
const SIGMA_DE = 9;

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
};

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** sRGB (0-255) -> CIELAB D65. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB D65 -> sRGB (0-255). */
export function labToRgb([L, a, b]: Lab): Rgb {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * 0.95047;
  const y = inv(fy);
  const z = inv(fz) * 1.08883;
  return [
    toSrgb(x * 3.2404542 - y * 1.5371385 - z * 0.4985314),
    toSrgb(-x * 0.969266 + y * 1.8760108 + z * 0.041556),
    toSrgb(x * 0.0556434 - y * 0.2040259 + z * 1.0572252),
  ];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** ΔE CIEDE2000 (Sharma, Wu y Dalal, 2005). */
export function ciede2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360;
  const h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    hpm = Math.abs(h1p - h2p) > 180 ? (hpm < 360 ? (hpm + 360) / 2 : (hpm - 360) / 2) : hpm / 2;
  }
  const T =
    1 - 0.17 * Math.cos(rad(hpm - 30)) + 0.24 * Math.cos(rad(2 * hpm)) +
    0.32 * Math.cos(rad(3 * hpm + 6)) - 0.2 * Math.cos(rad(4 * hpm - 63));
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const PALETTE_LAB: Lab[] = GARMENT_PALETTE.map((p) => rgbToLab(hexToRgb(p.hex)));

export interface ColorNaming {
  name: string;
  /** Probabilidad del nombre frente al resto de la paleta (0-1). */
  probability: number;
  alternatives: { name: string; probability: number }[];
}

/** Nombre del color medido: probabilidad de cada nombre según su distancia CIEDE2000. */
export function nameColor(lab: Lab): ColorNaming {
  const logits = PALETTE_LAB.map((ref) => -(ciede2000(lab, ref) ** 2) / (2 * SIGMA_DE ** 2));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  const ranked = exps
    .map((v, i) => ({ name: GARMENT_PALETTE[i].name, probability: v / sum }))
    .sort((x, y) => y.probability - x.probability);
  return {
    name: ranked[0].name,
    probability: ranked[0].probability,
    alternatives: ranked.slice(1, 3).map((r) => ({ name: r.name, probability: Math.round(r.probability * 1000) / 1000 })),
  };
}

/**
 * Ganancias (von Kries, en espacio lineal) para neutralizar la luz a partir del fondo.
 * Solo si el fondo es liso y casi neutro (croma < 22): un fondo de color no dice nada de la luz.
 * Ganancias acotadas 0,7–1,45 como en el servidor.
 */
export function gainsFromBackground(background: Rgb | null): Rgb {
  if (!background) return [1, 1, 1];
  const [, a, b] = rgbToLab(background);
  if (Math.hypot(a, b) >= 22 || Math.max(...background) < 40) return [1, 1, 1];
  const lin = background.map(toLinear);
  const mean = (lin[0] + lin[1] + lin[2]) / 3;
  const raw = lin.map((c) => mean / Math.max(c, 1e-4));
  const m = (raw[0] + raw[1] + raw[2]) / 3;
  return raw.map((g) => Math.min(1.45, Math.max(0.7, g / m))) as Rgb;
}

export function applyGains(px: Rgb, gains: Rgb): Rgb {
  if (gains[0] === 1 && gains[1] === 1 && gains[2] === 1) return px;
  return [
    toSrgb(toLinear(px[0]) * gains[0]),
    toSrgb(toLinear(px[1]) * gains[1]),
    toSrgb(toLinear(px[2]) * gains[2]),
  ];
}

export interface GarmentColor {
  name: string;
  /** Color medido (no el de referencia de la paleta). */
  hex: string;
  rgb: Rgb;
  lab: Lab;
  /** Fracción de la prenda con este color (0-1). */
  share: number;
  probability: number;
  alternatives: { name: string; probability: number }[];
}

/**
 * Colores de una prenda a partir de sus píxeles (ya corregidos de luz).
 * Agrupa en Lab con celdas más anchas en luminosidad que en tono, y une los grupos a menos de
 * ΔE00 10 (la misma tela con luz y sombra). Descarta brillos especulares salvo en prendas blancas.
 */
export function summarizeGarmentColors(pixels: Rgb[], maxColors = 4): GarmentColor[] {
  if (!pixels.length) return [];
  const labs = pixels.map(rgbToLab);
  const specular = labs.map(([L, a, b]) => L > 96 && Math.hypot(a, b) < 4);
  const specularShare = specular.filter(Boolean).length / labs.length;
  const kept = specularShare < 0.5 ? labs.filter((_, i) => !specular[i]) : labs;

  const bins = new Map<string, { sum: Lab; n: number }>();
  for (const [L, a, b] of kept) {
    const key = `${Math.floor(L / 14)},${Math.floor(a / 7)},${Math.floor(b / 7)}`;
    const bin = bins.get(key) ?? { sum: [0, 0, 0] as Lab, n: 0 };
    bin.sum[0] += L;
    bin.sum[1] += a;
    bin.sum[2] += b;
    bin.n++;
    bins.set(key, bin);
  }
  let groups = [...bins.values()]
    .map((g) => ({ lab: [g.sum[0] / g.n, g.sum[1] / g.n, g.sum[2] / g.n] as Lab, n: g.n }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 40);

  // Unión aglomerativa: primero los pares más parecidos
  for (;;) {
    let best = { i: -1, j: -1, d: Infinity };
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = ciede2000(groups[i].lab, groups[j].lab);
        if (d < best.d) best = { i, j, d };
      }
    }
    if (best.d >= 10) break;
    const a = groups[best.i];
    const b = groups[best.j];
    const n = a.n + b.n;
    groups[best.i] = {
      lab: [(a.lab[0] * a.n + b.lab[0] * b.n) / n, (a.lab[1] * a.n + b.lab[1] * b.n) / n, (a.lab[2] * a.n + b.lab[2] * b.n) / n],
      n,
    };
    groups.splice(best.j, 1);
  }

  const total = groups.reduce((s, g) => s + g.n, 0) || 1;
  groups = groups.sort((x, y) => y.n - x.n);
  const named: GarmentColor[] = [];
  for (const g of groups) {
    const naming = nameColor(g.lab);
    // Dos tonos con el mismo nombre se presentan como uno solo (se suma su proporción)
    const same = named.find((c) => c.name === naming.name);
    if (same) {
      same.share += g.n / total;
      continue;
    }
    const rgb = labToRgb(g.lab);
    named.push({
      name: naming.name,
      hex: rgbToHex(rgb),
      rgb,
      lab: g.lab,
      share: g.n / total,
      probability: naming.probability,
      alternatives: naming.alternatives,
    });
  }
  return named.filter((c, i) => i === 0 || c.share >= 0.06).slice(0, maxColors);
}

/** Temperatura del color por su ángulo de tono en Lab (cálido: rojos-amarillos; frío: verdes-azules-violetas). */
export function colorTemperature([L, a, b]: Lab): 'frio' | 'calido' | 'neutro' {
  const chroma = Math.hypot(a, b);
  if (chroma < 12 || L < 12 || L > 95) return 'neutro';
  const h = (deg(Math.atan2(b, a)) + 360) % 360;
  // 0° magenta-rojo, 90° amarillo, 180° verde, 270° azul
  if (h >= 20 && h < 100) return 'calido';
  if (h >= 100 && h < 125) return chroma > 30 ? 'calido' : 'neutro'; // oliva y caqui
  if (h >= 345 || h < 20) return L < 35 ? 'frio' : 'calido';        // vino frío, rojo cálido
  return 'frio';
}
