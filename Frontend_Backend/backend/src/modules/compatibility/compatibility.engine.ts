/**
 * HU-024 / HU-025 / HU-027: semáforo de compatibilidad de una prenda (en tienda) con
 * la paleta personal, el Style DNA, la silueta y el armario real de la usuaria.
 * Función pura: verde (>= 0.72), amarillo (>= 0.5) o rojo, con los motivos.
 */
import { hexDistance, isHex } from '../../common/color/color.util';
import { average, DNA_DIMENSIONS, DnaVector, styleVector } from '../style/style-dna';
import { Garment, garmentColorScore, garmentDna, generateOutfits, OutfitContext } from '../outfits/outfit.engine';

export const COMPATIBILITY_VERSION = 'semaforo-1.0.0';

export type Light = 'verde' | 'amarillo' | 'rojo';

export interface CompatibilityFactor {
  factor: string;
  score: number;
  weight: number;
  detail: string;
}

export interface CompatibilityResult {
  version: string;
  light: Light;
  score: number;
  headline: string;
  factors: CompatibilityFactor[];
  reasons: string[];
  combinations: { count: number; examples: { items: { id: string; name: string | null; role: string }[]; score: number }[] };
  similarItems: { id: string; name: string | null; colorHex: string | null }[];
  budget: { price: number | null; limit: number | null; withinBudget: boolean | null };
  recommendation: string;
}

const LABELS: Record<string, string> = {
  blusas: 'blusa', camisas: 'camisa', camisetas: 'camiseta', tops: 'top', vestidos: 'vestido', pantalones: 'pantalón', jeans: 'jeans',
  faldas: 'falda', shorts: 'short', chaquetas: 'chaqueta', abrigos: 'abrigo', sueteres: 'suéter', blazers: 'blazer', zapatillas: 'zapatillas',
  tacones: 'tacones', botas: 'botas', sandalias: 'sandalias', bolsos: 'bolso', cinturones: 'cinturón', joyeria: 'joya', sombreros: 'sombrero',
  bufandas: 'bufanda', lentes: 'lentes', relojes: 'reloj',
};

function cosine01(a: DnaVector, b: DnaVector): number {
  let dot = 0, na = 0, nb = 0;
  for (const d of DNA_DIMENSIONS) {
    const x = a[d] - 50, y = b[d] - 50;
    dot += x * y; na += x * x; nb += y * y;
  }
  return na && nb ? Math.max(0, Math.min(1, 0.5 + dot / Math.sqrt(na * nb) / 2)) : 0.6;
}

const round = (x: number) => Math.round(x * 100) / 100;

export function evaluateCompatibility(
  candidate: Garment & { styles?: string[] },
  wardrobe: Garment[],
  ctx: OutfitContext & { garmentCuts?: string[]; bodyType?: string | null },
  price?: number | null,
): CompatibilityResult {
  const factors: CompatibilityFactor[] = [];
  const label = LABELS[candidate.subcategory] || 'prenda';

  // 1. Color frente a la paleta y a lo que evita
  const color = garmentColorScore(candidate, ctx);
  factors.push({ factor: 'Color y paleta personal', score: round(color.score), weight: 0.35, detail: color.detail });

  // 2. Estilo frente al Style DNA
  const styleVec = average((candidate.styles || []).map(styleVector).filter(Boolean) as DnaVector[]) || garmentDna(candidate);
  const style = ctx.dna ? cosine01(styleVec, ctx.dna) : 0.6;
  factors.push({
    factor: 'Estilo', score: round(style), weight: 0.2,
    detail: style >= 0.7 ? 'Encaja con tu Style DNA' : style >= 0.5 ? 'Se aleja un poco de tu estilo habitual' : 'Es muy distinto a lo que sueles preferir',
  });

  // 3. Silueta: ¿el tipo de prenda aparece entre los cortes recomendados?
  const cuts = (ctx.garmentCuts || []).map((c) => c.toLowerCase());
  const silhouetteMatch = cuts.some((c) => c.includes(label) || (label === 'jeans' && c.includes('pantalón')));
  const silhouette = !ctx.bodyType || !['superior', 'inferior', 'abrigo'].includes(candidate.category) ? 0.7 : silhouetteMatch ? 0.95 : 0.65;
  factors.push({
    factor: 'Silueta', score: silhouette, weight: 0.15,
    detail: !ctx.bodyType ? 'Haz tu análisis corporal para valorar el corte' : silhouetteMatch ? `Las prendas tipo ${label} favorecen tu silueta ${ctx.bodyType}` : 'Revisa el corte en el probador',
  });

  // 4. Combinaciones con el armario real
  const candidateId = candidate.id;
  const proposals = generateOutfits([...wardrobe, candidate], { ...ctx, occasion: ctx.occasion || null }, 6).filter((p) => p.items.some((i) => i.id === candidateId));
  const combos = proposals.length;
  const combosScore = wardrobe.length === 0 ? 0.5 : Math.min(1, 0.3 + combos * 0.18);
  factors.push({
    factor: 'Combina con tu armario', score: round(combosScore), weight: 0.3,
    detail: wardrobe.length === 0 ? 'Registra tu armario para saber con qué combina' : combos ? `Forma ${combos} outfit${combos > 1 ? 's' : ''} con prendas que ya tienes` : 'No encontramos combinaciones con tu armario actual',
  });

  // Prendas casi iguales (evitar duplicados)
  const similar = wardrobe.filter((g) => g.subcategory === candidate.subcategory && g.colorHex && candidate.colorHex && isHex(g.colorHex) && isHex(candidate.colorHex) && hexDistance(g.colorHex, candidate.colorHex) < 12);

  let score = factors.reduce((a, f) => a + f.score * f.weight, 0) / factors.reduce((a, f) => a + f.weight, 0);
  if (color.score === 0) score = Math.min(score, 0.35); // color que la usuaria evita: nunca verde
  if (similar.length) score -= 0.08;
  const limit = ctx.budgetPerGarment ?? null;
  const withinBudget = price != null && limit != null ? price <= limit : null;
  if (withinBudget === false) score -= 0.1;
  score = round(Math.max(0, Math.min(1, score)));

  const light: Light = score >= 0.72 ? 'verde' : score >= 0.5 ? 'amarillo' : 'rojo';
  const reasons = factors.sort((a, b) => b.weight * Math.abs(b.score - 0.6) - a.weight * Math.abs(a.score - 0.6)).map((f) => `${f.factor}: ${f.detail}`);
  if (similar.length) reasons.push(`Ya tienes ${similar.length === 1 ? 'una prenda muy parecida' : `${similar.length} prendas muy parecidas`} (${similar.map((s) => s.name || label).slice(0, 2).join(', ')}).`);
  if (withinBudget === false) reasons.push(`Supera tu presupuesto de ${limit} por prenda.`);

  const headline = { verde: `Esta ${label} es muy compatible contigo`, amarillo: `Esta ${label} puede funcionar con matices`, rojo: `Esta ${label} no parece la mejor opción para ti` }[light];
  const recommendation = {
    verde: 'Buena compra: armoniza con tu paleta y la aprovecharás con lo que ya tienes.',
    amarillo: 'Pruébatela y piensa con qué la usarías; si dudas, busca un tono más cercano a tu paleta.',
    rojo: 'Mejor busca una alternativa: no favorece tu paleta o no combina con tu armario.',
  }[light];

  return {
    version: COMPATIBILITY_VERSION,
    light,
    score,
    headline,
    factors,
    reasons,
    combinations: {
      count: combos,
      examples: proposals.slice(0, 2).map((p) => ({ score: p.score, items: p.items.map((i) => ({ id: i.id, name: i.id === candidateId ? `Esta ${label}` : i.name, role: i.role })) })),
    },
    similarItems: similar.map((s) => ({ id: s.id, name: s.name, colorHex: s.colorHex })),
    budget: { price: price ?? null, limit, withinBudget },
    recommendation,
  };
}
