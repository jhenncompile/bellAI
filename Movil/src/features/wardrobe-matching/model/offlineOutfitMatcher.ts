import { Garment } from '@/entities/wardrobe/model/types';
import {
  GeneratedOutfit,
  OutfitHarmony,
  OutfitOccasion,
  OutfitPiece,
  OutfitSeason,
} from '@/features/outfit-combinations/model/outfit.types';
import { hexToRgb, rgbToLab } from '@/shared/lib/garmentColor';

/**
 * Combinaciones sin conexión: se usan solo cuando el servidor no responde.
 *
 * Aplica las mismas reglas de color que el motor de outfits del servidor
 * (`backend/src/modules/outfits/outfit.engine.ts`): neutros de moda (grises, negro, blanco,
 * marino, denim y tierras suaves), colores análogos o complementarios y un solo color protagonista.
 * El armario guardado en el teléfono no tiene subtipo, temporada ni uso de cada prenda, así que
 * esos datos se dejan vacíos en lugar de inventarlos.
 */

interface Lch {
  L: number;
  C: number;
  h: number;
}

function hexToLch(hex?: string | null): Lch | null {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex.trim())) return null;
  const [L, a, b] = rgbToLab(hexToRgb(hex));
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/** ¿Funciona como neutro en un conjunto? Misma regla que `isFashionNeutral` del servidor. */
export function isFashionNeutral(hex?: string | null, colorName?: string | null): boolean {
  if (colorName && /denim|jean|vaquero/i.test(colorName)) return true;
  const c = hexToLch(hex);
  if (!c) return false;
  if (c.C < 12 || c.L < 18 || c.L > 92) return true;
  return (c.h >= 40 && c.h <= 90 && c.C < 32 && c.L > 30) || (c.L < 30 && c.h > 230 && c.h < 300 && c.C < 40);
}

export interface ColorMatch {
  score: number; // 0..1
  harmony: OutfitHarmony;
  label: string;
  reason: string;
}

type ColorOf = Pick<Garment, 'primaryColorHex' | 'colorName'>;

/** Armonía entre los colores de dos prendas. */
export function matchColors(a?: ColorOf, b?: ColorOf): ColorMatch {
  const la = hexToLch(a?.primaryColorHex);
  const lb = hexToLch(b?.primaryColorHex);
  if (!la || !lb) {
    return { score: 0.6, harmony: 'sin_datos', label: 'Color sin identificar', reason: 'Falta el color de alguna prenda.' };
  }
  const na = isFashionNeutral(a?.primaryColorHex, a?.colorName);
  const nb = isFashionNeutral(b?.primaryColorHex, b?.colorName);
  if (na && nb) {
    // Dos neutros: funciona si hay contraste de claridad; dos oscuros parecidos se ven apagados
    return Math.abs(la.L - lb.L) >= 20
      ? { score: 0.85, harmony: 'base_neutra', label: 'Neutros con contraste', reason: 'Dos neutros con distinta claridad: conjunto sobrio y equilibrado.' }
      : { score: 0.7, harmony: 'base_neutra', label: 'Neutros parecidos', reason: 'Dos neutros de claridad parecida: un accesorio de color le da vida.' };
  }
  if (na || nb) {
    return { score: 0.9, harmony: 'base_neutra', label: 'Base neutra', reason: 'Un color protagonista sobre una prenda neutra.' };
  }
  let diff = Math.abs(la.h - lb.h);
  diff = Math.min(diff, 360 - diff);
  if (diff < 40) {
    return { score: 0.85, harmony: 'misma_familia', label: 'Colores vecinos', reason: 'Colores cercanos en el círculo cromático: conjunto suave.' };
  }
  if (diff > 150) {
    return { score: 0.8, harmony: 'contraste', label: 'Contraste complementario', reason: 'Colores opuestos: contraste intencional que resalta.' };
  }
  return { score: 0.45, harmony: 'contraste', label: 'Contraste arriesgado', reason: 'Los colores compiten: equilibra con una pieza neutra.' };
}

const ROLE_META = {
  superior: { roleLabel: 'Prenda superior', category: 'superior', categoryLabel: 'Prendas superiores' },
  inferior: { roleLabel: 'Prenda inferior', category: 'inferior', categoryLabel: 'Prendas inferiores' },
  calzado: { roleLabel: 'Calzado', category: 'calzado', categoryLabel: 'Calzado' },
  abrigo: { roleLabel: 'Abrigo', category: 'abrigo', categoryLabel: 'Abrigos' },
} as const;

function piece(g: Garment, role: keyof typeof ROLE_META, season: OutfitSeason | null): OutfitPiece {
  const meta = ROLE_META[role];
  return {
    role,
    roleLabel: meta.roleLabel,
    item: {
      id: g.id,
      name: g.name,
      category: meta.category,
      subcategory: '',
      categoryLabel: meta.categoryLabel,
      color: g.colorName || null,
      colorHex: hexToLch(g.primaryColorHex) ? g.primaryColorHex : null,
      season,
      photoUrl: g.imageUri || null,
      // Sin dato de uso en el teléfono: -1 evita que la pantalla muestre «Sin estrenar»
      wearCount: -1,
      lastWornAt: null,
    },
  };
}

const SEASON_LABELS: Record<OutfitSeason, string> = {
  primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno', todo_el_ano: 'Todo el año',
};
const OCCASION_LABELS: Partial<Record<OutfitOccasion, string>> = {
  trabajo: 'Trabajo', universidad: 'Universidad', evento: 'Evento', diario: 'Diario', deporte: 'Deporte',
};

/** Prenda que mejor combina con el par superior + inferior (manda la peor armonía de las dos). */
function bestCompanion(pool: Garment[], top: Garment, bottom: Garment, used: Map<string, number>): Garment | null {
  if (!pool.length) return null;
  const fit = (g: Garment) => Math.min(matchColors(g, top).score, matchColors(g, bottom).score) - (used.get(g.id) ?? 0) * 0.05;
  const best = [...pool].sort((x, y) => fit(y) - fit(x))[0];
  used.set(best.id, (used.get(best.id) ?? 0) + 1);
  return best;
}

/** Combina superior + inferior (+ calzado, + abrigo si hace frío) del armario guardado en el dispositivo. */
export function generateOfflineOutfits(
  garments: Garment[],
  options?: { season?: OutfitSeason; occasion?: OutfitOccasion; limit?: number; cold?: boolean },
): GeneratedOutfit[] {
  const tops = garments.filter((g) => g.category === 'Superior');
  const bottoms = garments.filter((g) => g.category === 'Inferior');
  const shoes = garments.filter((g) => g.category === 'Calzado');
  const coats = garments.filter((g) => g.category === 'Abrigo');
  if (tops.length === 0 || bottoms.length === 0) return [];

  const season = options?.season ?? null;
  const limit = options?.limit || 6;
  const occasion = options?.occasion && options.occasion !== 'todas' ? options.occasion : undefined;

  // Variedad: cada prenda principal aparece como mucho dos veces
  const ranked = tops
    .flatMap((top) => bottoms.map((bottom) => ({ top, bottom, match: matchColors(top, bottom) })))
    .sort((x, y) => y.match.score - x.match.score);
  const uses = new Map<string, number>();
  const pairs: typeof ranked = [];
  for (const p of ranked) {
    if (pairs.length >= limit) break;
    if ((uses.get(p.top.id) ?? 0) >= 2 || (uses.get(p.bottom.id) ?? 0) >= 2) continue;
    uses.set(p.top.id, (uses.get(p.top.id) ?? 0) + 1);
    uses.set(p.bottom.id, (uses.get(p.bottom.id) ?? 0) + 1);
    pairs.push(p);
  }

  const shoeUses = new Map<string, number>();
  const coatUses = new Map<string, number>();
  return pairs.map(({ top, bottom, match }) => {
    const pieces = [piece(top, 'superior', season), piece(bottom, 'inferior', season)];
    const shoe = bestCompanion(shoes, top, bottom, shoeUses);
    if (shoe) pieces.push(piece(shoe, 'calzado', season));
    if (options?.cold || season === 'invierno' || season === 'otono') {
      const coat = bestCompanion(coats, top, bottom, coatUses);
      if (coat) pieces.push(piece(coat, 'abrigo', season));
    }
    return {
      id: `outfit-offline-${pieces.map((p) => p.item.id).join('-')}`,
      type: 'dos_piezas',
      season,
      seasonLabel: season ? SEASON_LABELS[season] : 'Todas las temporadas',
      occasion,
      occasionLabel: occasion ? OCCASION_LABELS[occasion] : undefined,
      pieces,
      reason: `${match.reason} Sugerencia sin conexión: solo se tienen en cuenta los colores de tus prendas.`,
      harmony: match.harmony,
      harmonyLabel: match.label,
      isPrioritized: false,
    };
  });
}
