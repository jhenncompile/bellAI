/**
 * HU-015 / HU-016 / HU-017 / HU-038: generación de outfits con las prendas reales del armario.
 * Puntúa cada combinación por armonía de color con la paleta personal, ocasión, clima,
 * Style DNA, rotación del armario (prendas poco usadas) y valoraciones previas.
 * Función pura: se prueba sin base de datos.
 */
import { createHash } from 'crypto';
import { hexDistance, hexToLab, isHex, isNeutral, matchesDeclared } from '../../common/color/color.util';
import { DNA_DIMENSIONS, DnaVector, NEUTRAL_DNA, styleVector } from '../style/style-dna';
import { normalizeOccasion } from '../style/recommendation.engine';
import { FeedbackProfile, garmentAffinity, outfitAffinity } from './feedback-profile';

// 1.3.0 (HU-23): perfil de gustos aprendido de las valoraciones (prendas, colores, tipos y combinaciones)
export const OUTFIT_ENGINE_VERSION = 'outfits-1.3.0';

export interface Garment {
  id: string;
  name: string | null;
  category: 'superior' | 'inferior' | 'calzado' | 'abrigo' | 'accesorio';
  subcategory: string;
  color: string | null;
  colorHex: string | null;
  season: string | null;
  occasion: string | null;
  wearCount: number;
  lastWornAt: string | null;
  imageUrl?: string | null;
  /** Estampado que detectó la IA (liso, rayas, cuadros, floral, lunares, animal, geometrico) */
  pattern?: string | null;
  /** Estilos que CLIP vio en la foto (Clásico, Romántico, Deportivo…), de más a menos probable */
  styles?: string[];
  /** Ocasión que sugirió la IA; se usa si la usuaria no etiquetó la prenda */
  aiOccasion?: string | null;
}

export interface OutfitContext {
  occasion?: string | null;
  temperatureC?: number | null;
  rainy?: boolean;
  palette?: { hex: string; name: string }[];
  avoidColors?: { hex?: string; name: string }[];
  declaredAvoid?: string[];
  declaredPreferred?: string[];
  dna?: DnaVector;
  budgetPerGarment?: number | null;
  dislikedOutfits?: Set<string>;
  likedOutfits?: Set<string>;
  dislikedGarments?: Set<string>;
  likedGarments?: Set<string>;
  /** HU-23: gustos aprendidos de todas sus valoraciones */
  feedback?: FeedbackProfile;
}

/** Peso de las valoraciones en la puntuación total (±0,12 como mucho). */
const FEEDBACK_WEIGHT = 0.12;
/** Prendas principales de un conjunto: con ellas se reconoce una combinación ya valorada. */
const coreIds = (items: (Garment & { role: string })[]) =>
  items.filter((g) => g.role === 'superior' || g.role === 'inferior' || g.role === 'vestido').map((g) => g.id);

export interface ScoreFactor {
  factor: string;
  score: number;
  detail: string;
}

export interface OutfitProposal {
  id: string;
  title: string;
  items: (Garment & { role: string })[];
  score: number;
  breakdown: ScoreFactor[];
  explanation: string[];
  missing: { role: string; suggestion: string }[];
  dna: DnaVector;
}

/** Afinidad de cada subcategoría con las dimensiones del Style DNA. */
const SUB_DNA: Record<string, Partial<DnaVector>> = {
  blazers: { elegancia: 85, clasicismo: 80, minimalismo: 60 },
  camisas: { clasicismo: 75, elegancia: 65, minimalismo: 60 },
  blusas: { romanticismo: 65, elegancia: 60 },
  camisetas: { naturalidad: 80, minimalismo: 70 },
  tops: { experimentalidad: 55, dramatismo: 50 },
  vestidos: { romanticismo: 80, elegancia: 65 },
  pantalones: { clasicismo: 65, elegancia: 60, minimalismo: 60 },
  jeans: { naturalidad: 85, minimalismo: 50 },
  faldas: { romanticismo: 70, elegancia: 55 },
  shorts: { naturalidad: 80, experimentalidad: 45 },
  chaquetas: { naturalidad: 60, dramatismo: 50 },
  abrigos: { elegancia: 75, clasicismo: 70, dramatismo: 55 },
  sueteres: { naturalidad: 75, romanticismo: 50 },
  zapatillas: { naturalidad: 85, experimentalidad: 45 },
  tacones: { elegancia: 85, dramatismo: 65 },
  botas: { dramatismo: 65, clasicismo: 55 },
  sandalias: { naturalidad: 70, romanticismo: 55 },
  bolsos: { elegancia: 65, clasicismo: 60 },
  joyeria: { elegancia: 70, romanticismo: 60 },
  cinturones: { clasicismo: 60, elegancia: 55 },
  sombreros: { experimentalidad: 60, naturalidad: 55 },
  bufandas: { romanticismo: 55, naturalidad: 60 },
  lentes: { dramatismo: 55, experimentalidad: 50 },
  relojes: { clasicismo: 70, elegancia: 65 },
};

/** Ocasiones compatibles con la ocasión etiquetada en la prenda. */
const OCCASION_FIT: Record<string, string[]> = {
  trabajo: ['trabajo', 'formal'],
  entrevista: ['trabajo', 'formal'],
  formal: ['formal', 'gala', 'trabajo'],
  fiesta: ['fiesta', 'gala', 'formal'],
  cita: ['fiesta', 'casual', 'formal'],
  universidad: ['casual', 'deporte', 'trabajo'],
  casual: ['casual', 'deporte', 'playa'],
  deporte: ['deporte', 'casual'],
  playa: ['playa', 'casual'],
  evento: ['fiesta', 'gala', 'formal'],
  diario: ['casual', 'trabajo', 'deporte'],
};
const FORMAL_SUBS = new Set(['blazers', 'tacones', 'camisas', 'pantalones', 'abrigos', 'relojes']);
const SPORTY_SUBS = new Set(['zapatillas', 'shorts', 'camisetas']);
const WARM_SEASONS = new Set(['verano', 'primavera', 'todo_el_ano']);
const COLD_SEASONS = new Set(['invierno', 'otono', 'todo_el_ano']);

/**
 * Formalidad de cada subcategoría (0 = deporte, 1 = gala). Un conjunto con piezas muy dispares
 * (blazer con shorts y zapatillas) se penaliza aunque cada prenda encaje sola en la ocasión.
 */
const FORMALITY: Record<string, number> = {
  shorts: 0.1, zapatillas: 0.15, camisetas: 0.25, sandalias: 0.3, jeans: 0.35, sueteres: 0.4, tops: 0.45,
  chaquetas: 0.45, bufandas: 0.5, botas: 0.5, faldas: 0.55, blusas: 0.6, vestidos: 0.6, pantalones: 0.65,
  camisas: 0.7, abrigos: 0.7, tacones: 0.8, blazers: 0.85,
};
/** Prendas que en moda funcionan como neutras aunque tengan color (el denim combina con todo). */
const NEUTRAL_SUBS = new Set(['jeans']);

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Estilo de una prenda: el de su tipo (un blazer suele ser elegante) mezclado con lo que la IA vio
 * en la foto (un blazer de lino arrugado puede ser «Casual»). Con la foto analizada pesa 50/50.
 */
export function garmentDna(g: Garment): DnaVector {
  const base: DnaVector = { ...NEUTRAL_DNA, ...(SUB_DNA[g.subcategory] || {}) };
  const seen = (g.styles || []).slice(0, 2).map(styleVector).filter((x): x is DnaVector => Boolean(x));
  if (!seen.length) return base;
  const out = { ...base };
  for (const d of DNA_DIMENSIONS) {
    const ai = seen.length === 1 ? seen[0][d] : seen[0][d] * 0.65 + seen[1][d] * 0.35;
    out[d] = Math.round(base[d] * 0.5 + ai * 0.5);
  }
  return out;
}

function cosine(a: DnaVector, b: DnaVector): number {
  let dot = 0, na = 0, nb = 0;
  for (const d of DNA_DIMENSIONS) {
    const x = a[d] - 50, y = b[d] - 50;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function outfitSignature(itemIds: string[], occasion?: string | null): string {
  return createHash('sha1').update([...itemIds].sort().join('|') + '#' + (normalizeOccasion(occasion) || '')).digest('hex').slice(0, 16);
}

/** Puntuación de color de una prenda frente a la paleta personal y los colores a evitar. */
export function garmentColorScore(g: Garment, ctx: OutfitContext): { score: number; detail: string } {
  const hex = g.colorHex && isHex(g.colorHex) ? g.colorHex : null;
  const name = g.color || '';
  const declaredAvoid = matchesDeclared(name, hex, ctx.declaredAvoid);
  if (declaredAvoid) return { score: 0, detail: `${name || 'Este color'} está en tus colores a evitar` };
  if (!hex) return { score: 0.6, detail: 'Color sin identificar' };
  if (isNeutral(hex)) return { score: 0.8, detail: `${name || hex} es neutro y combina con tu paleta` };
  const toxic = (ctx.avoidColors || []).find((t) => t.hex && isHex(t.hex) && hexDistance(t.hex, hex) < 15);
  if (toxic) return { score: 0.2, detail: `${name || hex} se parece a ${toxic.name}, que reduce tu armonía` };
  const palette = ctx.palette || [];
  if (!palette.length) return { score: 0.65, detail: 'Haz tu diagnóstico para valorar el color' };
  const best = palette.reduce((acc, p) => {
    const d = isHex(p.hex) ? hexDistance(p.hex, hex) : 999;
    return d < acc.d ? { d, p } : acc;
  }, { d: 999, p: palette[0] });
  const preferred = matchesDeclared(name, hex, ctx.declaredPreferred);
  // Lejos de la paleta resta, pero no excluye: 0 se reserva para los colores que la usuaria declaró evitar
  const base = 0.25 + 0.75 * clamp01(1 - best.d / 60);
  return {
    score: clamp01(base + (preferred ? 0.15 : 0)),
    detail: best.d < 20 ? `${name || hex} está en tu paleta (cercano a ${best.p.name})` : `${name || hex} queda lejos de tu paleta`,
  };
}

/** ¿Funciona como neutro en un conjunto? Grises, negro, blanco, denim y tierras suaves (beige, camel, nude). */
export function isFashionNeutral(g: Pick<Garment, 'subcategory' | 'colorHex'>): boolean {
  if (NEUTRAL_SUBS.has(g.subcategory)) return true;
  if (!g.colorHex || !isHex(g.colorHex)) return false;
  if (isNeutral(g.colorHex)) return true;
  const [L, a, b] = hexToLab(g.colorHex);
  const chroma = Math.hypot(a, b);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  // Tierras: tono anaranjado-amarillento (40°-90°), saturación moderada. Marino: azul muy oscuro.
  return (hue >= 40 && hue <= 90 && chroma < 32 && L > 30) || (L < 30 && hue > 230 && hue < 300 && chroma < 40);
}

/** Armonía entre los colores no neutros del conjunto (análogos o complementarios). */
function harmony(items: Garment[]): { score: number; detail: string } {
  const accents = items.filter((g) => g.colorHex && isHex(g.colorHex) && !isFashionNeutral(g));
  if (accents.length <= 1) return { score: 0.9, detail: accents.length ? 'Un color protagonista con neutros' : 'Conjunto en tonos neutros' };
  if (accents.length > 3) return { score: 0.35, detail: 'Demasiados colores intensos a la vez' };
  const hues = accents.map((g) => {
    const [, a, b] = hexToLab(g.colorHex!);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  });
  let worst = 1;
  for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) {
    const diff = Math.min(Math.abs(hues[i] - hues[j]), 360 - Math.abs(hues[i] - hues[j]));
    const s = diff < 40 ? 0.95 : diff > 150 ? 0.85 : diff > 100 ? 0.65 : 0.45;
    worst = Math.min(worst, s);
  }
  return { score: worst, detail: worst >= 0.85 ? 'Colores análogos o complementarios' : 'Los colores compiten entre sí' };
}

/** Coherencia de estilo: formalidad parecida y como mucho una prenda estampada. */
function coherence(items: (Garment & { role?: string })[]): { score: number; detail: string } {
  const levels = items.map((g) => FORMALITY[g.subcategory]).filter((x): x is number => x !== undefined);
  const spread = levels.length > 1 ? Math.max(...levels) - Math.min(...levels) : 0;
  let score = clamp01(1 - Math.max(0, spread - 0.3) * 1.6);
  const details: string[] = [];
  if (spread > 0.5) details.push('mezcla piezas muy formales con otras muy deportivas');
  const printed = items.filter((g) => g.pattern && g.pattern !== 'liso' && g.role !== 'accesorio');
  if (printed.length > 1) {
    score = Math.min(score, 0.4);
    details.push(`${printed.length} prendas estampadas compiten entre sí`);
  }
  if (!details.length) {
    return { score, detail: printed.length === 1 ? 'Un estampado protagonista con prendas lisas' : 'Piezas del mismo nivel de formalidad' };
  }
  return { score, detail: details.join('; ') };
}

function occasionScore(g: Garment, occ: string | null): number {
  if (!occ) return 0.8;
  const fits = OCCASION_FIT[occ] || [occ];
  // La etiqueta de la usuaria manda; la ocasión sugerida por la IA cuenta un poco menos
  let s = g.occasion ? (fits.includes(g.occasion) ? 1 : 0.45)
    : g.aiOccasion ? (fits.includes(g.aiOccasion) ? 0.9 : 0.55) : 0.7;
  if (['trabajo', 'entrevista', 'formal'].includes(occ) && SPORTY_SUBS.has(g.subcategory)) s -= 0.3;
  if (['deporte', 'playa'].includes(occ) && FORMAL_SUBS.has(g.subcategory)) s -= 0.35;
  return clamp01(s);
}

function weatherScore(g: Garment, t: number | null | undefined, rainy?: boolean): number {
  let s = 0.85;
  if (t !== null && t !== undefined) {
    if (t >= 25) {
      if (g.season && !WARM_SEASONS.has(g.season)) s = 0.35;
      if (['abrigos', 'sueteres', 'bufandas', 'botas'].includes(g.subcategory)) s = Math.min(s, 0.25);
    } else if (t < 15) {
      if (g.season && !COLD_SEASONS.has(g.season)) s = 0.4;
      if (['shorts', 'sandalias'].includes(g.subcategory)) s = Math.min(s, 0.2);
    }
  }
  if (rainy && ['sandalias', 'tacones'].includes(g.subcategory)) s = Math.min(s, 0.35);
  if (rainy && g.subcategory === 'botas') s = Math.max(s, 0.95);
  return s;
}

function rotationScore(g: Garment): number {
  const days = g.lastWornAt ? (Date.now() - new Date(g.lastWornAt).getTime()) / 86_400_000 : 60;
  return clamp01(0.5 + Math.min(days, 60) / 120 - Math.min(g.wearCount, 30) / 100);
}

function itemScore(g: Garment, ctx: OutfitContext, occ: string | null): number {
  if (ctx.dislikedGarments?.has(g.id)) return 0;
  const color = garmentColorScore(g, ctx).score;
  if (color === 0) return 0;
  const liked = ctx.likedGarments?.has(g.id) ? 0.1 : 0;
  // HU-23: lo que agradó sube y lo que no, baja (sin llegar a excluirla: aparece con menor frecuencia)
  const learned = ctx.feedback ? garmentAffinity(ctx.feedback, g) * 0.1 : 0;
  return clamp01(color * 0.35 + occasionScore(g, occ) * 0.3 + weatherScore(g, ctx.temperatureC, ctx.rainy) * 0.25 + rotationScore(g) * 0.1 + liked + learned);
}

const ROLE_LABEL: Record<string, string> = { superior: 'parte de arriba', inferior: 'parte de abajo', vestido: 'vestido', calzado: 'calzado', abrigo: 'abrigo o chaqueta', accesorio: 'accesorio' };

function missingSuggestion(role: string, occ: string | null, t: number | null | undefined, budget?: number | null): string {
  const suggestions: Record<string, string> = {
    calzado: occ === 'trabajo' || occ === 'formal' ? 'Unos zapatos cerrados neutros (negro, nude o camel)' : 'Unas zapatillas blancas versátiles',
    inferior: occ === 'trabajo' ? 'Un pantalón recto en color neutro' : 'Unos jeans rectos de tono medio',
    superior: 'Una camiseta o blusa lisa en un neutro de tu paleta',
    abrigo: t !== null && t !== undefined && t < 15 ? 'Un abrigo o chaqueta abrigada en neutro' : 'Un blazer o chaqueta ligera',
  };
  const base = suggestions[role] || `Agrega ${ROLE_LABEL[role] || role} a tu armario`;
  return budget ? `${base}, dentro de tu presupuesto de ${budget} por prenda.` : `${base}.`;
}

function pickTop<T>(list: T[], score: (x: T) => number, n: number): T[] {
  return [...list].map((x) => ({ x, s: score(x) })).filter((e) => e.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((e) => e.x);
}

/** Evalúa un conjunto concreto (usado también para comparar outfits, HU-017). */
export function scoreOutfit(items: (Garment & { role: string })[], ctx: OutfitContext): Omit<OutfitProposal, 'title' | 'missing'> {
  const occ = normalizeOccasion(ctx.occasion);
  const colorParts = items.map((g) => garmentColorScore(g, ctx));
  const color = colorParts.reduce((a, c) => a + c.score, 0) / Math.max(1, colorParts.length);
  const harm = harmony(items);
  const coh = coherence(items);
  const occScore = items.reduce((a, g) => a + occasionScore(g, occ), 0) / Math.max(1, items.length);
  const weather = items.reduce((a, g) => a + weatherScore(g, ctx.temperatureC, ctx.rainy), 0) / Math.max(1, items.length);
  const vec: DnaVector = { ...NEUTRAL_DNA };
  for (const d of DNA_DIMENSIONS) vec[d] = Math.round(items.reduce((a, g) => a + garmentDna(g)[d], 0) / Math.max(1, items.length));
  const dnaFit = ctx.dna ? clamp01(0.5 + cosine(vec, ctx.dna) / 2) : 0.6;
  const rotation = items.reduce((a, g) => a + rotationScore(g), 0) / Math.max(1, items.length);
  const ids = items.map((g) => g.id);
  const id = outfitSignature(ids, ctx.occasion);
  const feedbackBoost = ctx.likedOutfits?.has(id) ? 0.08 : 0;
  const core = coreIds(items);
  const learned = ctx.feedback?.size ? outfitAffinity(ctx.feedback, items, core.length ? core : ids) : null;
  const total = clamp01(color * 0.25 + harm.score * 0.15 + coh.score * 0.12 + occScore * 0.18 + weather * 0.13 + dnaFit * 0.1 + rotation * 0.07 + feedbackBoost
    + (learned ? learned.value * FEEDBACK_WEIGHT : 0));
  const breakdown: ScoreFactor[] = [
    { factor: 'Paleta personal', score: round(color), detail: colorParts.map((c) => c.detail).join('; ') },
    { factor: 'Armonía de colores', score: round(harm.score), detail: harm.detail },
    { factor: 'Coherencia de estilo', score: round(coh.score), detail: coh.detail },
    { factor: 'Ocasión', score: round(occScore), detail: occ ? `Adecuación a ${ctx.occasion}` : 'Sin ocasión indicada' },
    { factor: 'Clima', score: round(weather), detail: ctx.temperatureC !== null && ctx.temperatureC !== undefined ? `${Math.round(ctx.temperatureC)} °C${ctx.rainy ? ', con lluvia' : ''}` : 'Sin datos de clima' },
    { factor: 'Style DNA', score: round(dnaFit), detail: 'Parecido del conjunto con tu perfil de estilo' },
    { factor: 'Aprovechar tu armario', score: round(rotation), detail: 'Prioriza prendas que usas poco' },
    // HU-23: solo cuando ya hay valoraciones, para no mostrar un criterio vacío
    ...(learned ? [{ factor: 'Tus valoraciones', score: round((learned.value + 1) / 2), detail: learned.detail }] : []),
  ];
  const explanation = breakdown.filter((b) => b.score >= 0.75).map((b) => `${b.factor}: ${b.detail}`);
  return { id, items, score: round(total), breakdown, explanation, dna: vec };
}

export function generateOutfits(wardrobe: Garment[], ctx: OutfitContext, count = 3): OutfitProposal[] {
  const occ = normalizeOccasion(ctx.occasion);
  const t = ctx.temperatureC;
  const by = (pred: (g: Garment) => boolean) => wardrobe.filter(pred);
  const s = (g: Garment) => itemScore(g, ctx, occ);
  const dresses = pickTop(by((g) => g.subcategory === 'vestidos'), s, 4);
  // El suéter se guarda como «abrigo» pero se lleva como parte de arriba
  const isTop = (g: Garment) => (g.category === 'superior' && g.subcategory !== 'vestidos') || g.subcategory === 'sueteres';
  const tops = pickTop(by(isTop), s, 6);
  const bottoms = pickTop(by((g) => g.category === 'inferior'), s, 6);
  const shoes = pickTop(by((g) => g.category === 'calzado'), s, 4);
  const outers = pickTop(by((g) => g.category === 'abrigo' && g.subcategory !== 'sueteres'), s, 3);
  const accessories = pickTop(by((g) => g.category === 'accesorio'), s, 3);
  const needsOuter = (t !== null && t !== undefined && t < 16) || Boolean(ctx.rainy) || ['trabajo', 'entrevista', 'formal'].includes(occ || '');

  const bases: (Garment & { role: string })[][] = [];
  for (const d of dresses) bases.push([{ ...d, role: 'vestido' }]);
  for (const top of tops) for (const b of bottoms) bases.push([{ ...top, role: 'superior' }, { ...b, role: 'inferior' }]);
  if (!bases.length) {
    // Armario incompleto: se proponen las piezas disponibles y se indica lo que falta
    const partial = [...tops.slice(0, 1).map((g) => ({ ...g, role: 'superior' })), ...bottoms.slice(0, 1).map((g) => ({ ...g, role: 'inferior' }))];
    if (partial.length) bases.push(partial);
  }

  const candidates: OutfitProposal[] = [];
  for (const base of bases) {
    const shoeOpts = shoes.length ? shoes.slice(0, 3) : [null];
    const outerOpts = needsOuter && outers.length ? outers.slice(0, 2) : [null];
    for (const shoe of shoeOpts) for (const outer of outerOpts) {
      const items = [...base];
      if (shoe) items.push({ ...shoe, role: 'calzado' });
      if (outer) items.push({ ...outer, role: 'abrigo' });
      if (accessories.length) {
        const acc = pickTop(accessories, (a) => garmentColorScore(a, ctx).score * 0.5 + harmony([...items, a]).score * 0.5, 1)[0];
        if (acc) items.push({ ...acc, role: 'accesorio' });
      }
      const scored = scoreOutfit(items, ctx);
      if (ctx.dislikedOutfits?.has(scored.id)) continue;
      // HU-23: la misma combinación que no le agradó no se vuelve a proponer
      if (ctx.feedback && outfitAffinity(ctx.feedback, items, coreIds(items)).dislikedMatch) continue;
      const missing: { role: string; suggestion: string }[] = [];
      const roles = new Set(items.map((i) => i.role));
      if (!roles.has('vestido') && !roles.has('superior')) missing.push({ role: 'superior', suggestion: missingSuggestion('superior', occ, t, ctx.budgetPerGarment) });
      if (!roles.has('vestido') && !roles.has('inferior')) missing.push({ role: 'inferior', suggestion: missingSuggestion('inferior', occ, t, ctx.budgetPerGarment) });
      if (!roles.has('calzado')) missing.push({ role: 'calzado', suggestion: missingSuggestion('calzado', occ, t, ctx.budgetPerGarment) });
      if (needsOuter && !roles.has('abrigo')) missing.push({ role: 'abrigo', suggestion: missingSuggestion('abrigo', occ, t, ctx.budgetPerGarment) });
      // El armario tiene calzado, pero ninguno va con la ocasión (zapatillas para el trabajo)
      if (shoe && occ && occasionScore(shoe, occ) < 0.5) {
        missing.push({ role: 'calzado', suggestion: `Tu calzado actual no va del todo con la ocasión. ${missingSuggestion('calzado', occ, t, ctx.budgetPerGarment)}` });
      }
      const penalty = missing.length * 0.06;
      const main = items.find((i) => i.role === 'vestido' || i.role === 'superior');
      candidates.push({
        ...scored,
        score: round(Math.max(0, scored.score - penalty)),
        title: `${main?.name || ROLE_LABEL[main?.role || 'superior']}${ctx.occasion ? ` para ${String(ctx.occasion).toLowerCase()}` : ''}`,
        missing,
      });
    }
  }

  // Selección diversa: se penaliza repetir prendas entre propuestas
  candidates.sort((a, b) => b.score - a.score);
  const chosen: OutfitProposal[] = [];
  for (const c of candidates) {
    if (chosen.length >= count) break;
    const overlap = chosen.reduce((m, o) => Math.max(m, c.items.filter((i) => o.items.some((j) => j.id === i.id)).length / c.items.length), 0);
    if (overlap > 0.5) continue;
    chosen.push(c);
  }
  for (const c of candidates) {
    if (chosen.length >= count) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  // Variedad de silueta: si hay un vestido con puntuación cercana, se ofrece como última opción
  const isDress = (o: OutfitProposal) => o.items.some((i) => i.role === 'vestido');
  if (count >= 3 && chosen.length >= count && !chosen.some(isDress)) {
    const dress = candidates.find(isDress);
    if (dress && dress.score >= chosen[chosen.length - 1].score - 0.1) chosen[chosen.length - 1] = dress;
  }
  return chosen;
}

/** Diferencia mínima entre opciones para que un factor cuente como decisivo (15 puntos de 100). */
const DECISIVE_GAP = 0.15;
/** Por debajo de esta diferencia de puntuación total, las opciones se consideran empatadas. */
const TIE_GAP = 0.02;

export interface ComparedOption {
  index: number;
  title: string;
  score: number;
  breakdown: ScoreFactor[];
}

/**
 * HU-21: compara varias propuestas a la vez. Para cada una devuelve sus puntos fuertes y débiles
 * (el motivo, aunque no destaque en nada) y, para el conjunto, la más conveniente con el porqué:
 * los factores en los que gana con claridad. Si están muy parejas se dice, en lugar de forzar una.
 */
export function summarizeComparison(options: ComparedOption[]) {
  const factors = options[0]?.breakdown.map((b) => b.factor) ?? [];
  const rows = factors.map((factor) => {
    const scores = options.map((o) => o.breakdown.find((b) => b.factor === factor)?.score ?? 0);
    const max = Math.max(...scores);
    const leaders = scores.map((s, i) => (s === max ? i : -1)).filter((i) => i >= 0);
    const decisive = max - Math.min(...scores) >= DECISIVE_GAP;
    // Solo hay «líder» si es uno y la diferencia importa
    return { factor, scores, decisive, leader: decisive && leaders.length === 1 ? leaders[0] : null };
  });

  const ranked = [...options].map((o, pos) => ({ ...o, pos })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const tie = ranked.length > 1 && best.score - ranked[1].score < TIE_GAP;
  const wins = rows.filter((r) => r.leader === best?.pos).map((r) => r.factor);

  const perOption = options.map((o, pos) => ({
    index: o.index,
    strengths: o.breakdown.filter((b) => b.score >= 0.75).map((b) => `${b.factor}: ${b.detail}`),
    weaknesses: o.breakdown.filter((b) => b.score < 0.5).map((b) => `${b.factor}: ${b.detail}`),
    winsIn: rows.filter((r) => r.leader === pos).map((r) => r.factor),
  }));

  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]).toLowerCase();
  const summary = !best
    ? ''
    : tie
      ? `Las opciones están muy parejas (${Math.round(best.score * 100)}/100): elige la que más te guste.`
      : wins.length
        ? `${best.title} es la más conveniente: gana en ${list(wins)}.`
        : `${best.title} es la más conveniente por su puntuación global (${Math.round(best.score * 100)}/100).`;

  return {
    rows,
    perOption,
    winner: best ? { index: best.index, title: best.title, score: best.score, tie, winsIn: wins, summary } : null,
  };
}
