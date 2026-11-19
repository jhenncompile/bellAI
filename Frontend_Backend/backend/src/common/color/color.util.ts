/** Utilidades de color (sRGB -> CIELAB D65, ΔE CIE76 y CIEDE2000) compartidas por recomendaciones, outfits y compatibilidad. */
export type Lab = [number, number, number];

export function isHex(value: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(value.trim());
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function hexToLab(hex: string): Lab {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Diferencia de color CIEDE2000 (Sharma, Wu y Dalal, 2005): pesa las diferencias como las percibe
 * el ojo. ~2 apenas se nota, <10 es «el mismo color» en ropa. Misma implementación que el servicio
 * de IA (garment_color.py) y la app (garmentColor.ts).
 */
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

export function hexDistance2000(a: string, b: string): number {
  return ciede2000(hexToLab(a), hexToLab(b));
}

export function hexDistance(a: string, b: string): number {
  return deltaE(hexToLab(a), hexToLab(b));
}

/** Chroma y luminosidad para reglas de neutros ("combina con todo"). */
export function isNeutral(hex: string): boolean {
  const [L, a, b] = hexToLab(hex);
  return Math.hypot(a, b) < 12 || L < 18 || L > 92;
}

const COLOR_WORDS: Record<string, string> = {
  negro: '#111111', blanco: '#F8F8F8', gris: '#808080', beige: '#D8C3A5', crema: '#F3E5C8', marfil: '#F5EFE0',
  camel: '#B58A5A', marron: '#6B4423', marrón: '#6B4423', cafe: '#6B4423', café: '#6B4423', chocolate: '#3B1F0E',
  rojo: '#C62828', vino: '#6D1A36', burdeos: '#6D1A36', rosa: '#F06292', fucsia: '#D81B60', coral: '#FF7F6B',
  naranja: '#F57C00', terracota: '#B5532A', mostaza: '#C9A227', amarillo: '#FBC02D', dorado: '#C9A227',
  verde: '#2E7D32', oliva: '#6B7B2B', menta: '#A7E8C8', esmeralda: '#047857', turquesa: '#14B8A6',
  azul: '#1E5BB8', marino: '#1F2A4A', celeste: '#7EC8E3', lila: '#B39DDB', lavanda: '#B8A9D9', morado: '#6A1B9A', violeta: '#7E57C2',
};

/** Convierte un color declarado por la usuaria (hex o nombre) a hex si es posible. */
export function colorToHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (isHex(v)) return v.startsWith('#') ? v.toUpperCase() : `#${v.toUpperCase()}`;
  for (const [word, hex] of Object.entries(COLOR_WORDS)) if (v.includes(word)) return hex;
  return null;
}

/** ¿El color (nombre+hex) coincide con alguno de la lista declarada (nombres o hex)? */
export function matchesDeclared(name: string, hex: string | null | undefined, declared: string[] = [], tolerance = 18): string | null {
  const n = (name || '').toLowerCase();
  for (const d of declared) {
    const dl = d.trim().toLowerCase();
    if (!dl) continue;
    if (n && (n.includes(dl) || dl.includes(n))) return d;
    const dh = colorToHex(dl);
    if (dh && hex && isHex(hex) && hexDistance(dh, hex) <= tolerance) return d;
  }
  return null;
}
