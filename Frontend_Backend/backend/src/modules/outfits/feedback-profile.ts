/**
 * HU-23: perfil de gustos aprendido de las valoraciones de la usuaria.
 *
 * Reúne lo que valoró (prendas sueltas y combinaciones, guardadas o no) y lo resume en afinidades
 * de -1 (no le agrada) a 1 (le agrada) por prenda, por color y por tipo de prenda. Los dos
 * generadores (`/outfits/generate` y `/wardrobe/outfits`) lo usan para que:
 *  - las prendas y combinaciones valoradas negativamente aparezcan con menor frecuencia;
 *  - las características valoradas positivamente (prendas, colores, tipos) se prioricen.
 * El estilo (Style DNA) ya aprende de las mismas valoraciones por su lado.
 */
import { itemSetKey } from './outfit-ratings';

export type FeedbackValue = 'me_gusta' | 'neutral' | 'no_me_gusta';

const SIGN: Record<FeedbackValue, number> = { me_gusta: 1, neutral: 0, no_me_gusta: -1 };

/** Peso de una valoración directa de la prenda frente a la de una combinación que la incluye. */
const DIRECT_WEIGHT = 1;
const OUTFIT_WEIGHT = 0.5;
/** A partir de aquí una prenda o rasgo cuenta como «le agrada» / «no le agrada» al explicarlo. */
const NOTABLE = 0.3;

export interface RatedOutfit {
  itemIds: string[];
  value: FeedbackValue;
}

export interface RatedGarment {
  id: string;
  value: FeedbackValue;
}

/** Lo mínimo de una prenda que hace falta para aprender de ella. */
export interface ProfileGarment {
  id: string;
  name?: string | null;
  color?: string | null;
  colorHex?: string | null;
  subcategory?: string | null;
}

export interface FeedbackProfile {
  /** Cuántas valoraciones se tuvieron en cuenta */
  size: number;
  garments: Map<string, number>;
  colors: Map<string, number>;
  subcategories: Map<string, number>;
  /** Prendas (ids) de cada combinación valorada */
  likedSets: string[][];
  dislikedSets: string[][];
}

export const colorKey = (g: Pick<ProfileGarment, 'color' | 'colorHex'>): string | null =>
  (g.color?.trim().toLowerCase() || g.colorHex?.trim().toLowerCase() || null);

const subKey = (g: Pick<ProfileGarment, 'subcategory'>): string | null => g.subcategory?.trim().toLowerCase() || null;

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/**
 * Construye el perfil. Si una misma combinación aparece varias veces (p. ej. valorada sin guardar
 * y luego guardada), cuenta una sola vez con la última valoración: `outfits` va de antigua a reciente.
 */
export function buildFeedbackProfile(input: { outfits: RatedOutfit[]; garments: RatedGarment[]; wardrobe: ProfileGarment[] }): FeedbackProfile {
  const byId = new Map(input.wardrobe.map((g) => [g.id.toLowerCase(), g]));
  const uniqueOutfits = new Map<string, RatedOutfit>();
  for (const o of input.outfits) if (o.itemIds.length) uniqueOutfits.set(itemSetKey(o.itemIds), o);
  const uniqueGarments = new Map<string, RatedGarment>();
  for (const g of input.garments) uniqueGarments.set(g.id.toLowerCase(), g);

  const garmentSum = new Map<string, number>();
  // Rasgos: suma y número de evidencias; afinidad = suma / (n + 1) para no exagerar con pocas
  const traits = { colors: new Map<string, { sum: number; n: number }>(), subcategories: new Map<string, { sum: number; n: number }>() };
  const addTrait = (map: Map<string, { sum: number; n: number }>, key: string | null, v: number) => {
    if (!key) return;
    const t = map.get(key) ?? { sum: 0, n: 0 };
    t.sum += v;
    t.n += 1;
    map.set(key, t);
  };
  const learn = (id: string, v: number, weight: number) => {
    const key = id.toLowerCase();
    garmentSum.set(key, (garmentSum.get(key) ?? 0) + v * weight);
    const g = byId.get(key);
    if (g) {
      addTrait(traits.colors, colorKey(g), v * weight);
      addTrait(traits.subcategories, subKey(g), v * weight);
    }
  };

  const likedSets: string[][] = [];
  const dislikedSets: string[][] = [];
  for (const o of uniqueOutfits.values()) {
    const ids = [...new Set(o.itemIds.map((id) => id.toLowerCase()))];
    const v = SIGN[o.value];
    if (v > 0) likedSets.push(ids);
    if (v < 0) dislikedSets.push(ids);
    for (const id of ids) learn(id, v, OUTFIT_WEIGHT);
  }
  for (const g of uniqueGarments.values()) learn(g.id, SIGN[g.value], DIRECT_WEIGHT);

  const finish = (m: Map<string, { sum: number; n: number }>) =>
    new Map([...m].map(([k, t]) => [k, clamp(t.sum / (t.n + 1))] as [string, number]).filter(([, v]) => v !== 0));

  return {
    size: uniqueOutfits.size + uniqueGarments.size,
    garments: new Map([...garmentSum].map(([k, v]) => [k, clamp(v)] as [string, number]).filter(([, v]) => v !== 0)),
    colors: finish(traits.colors),
    subcategories: finish(traits.subcategories),
    likedSets,
    dislikedSets,
  };
}

/** Afinidad de una prenda (-1..1): sobre todo por ella misma, y algo por su color y su tipo. */
export function garmentAffinity(p: FeedbackProfile, g: ProfileGarment): number {
  const own = p.garments.get(g.id.toLowerCase()) ?? 0;
  const color = p.colors.get(colorKey(g) ?? '') ?? 0;
  const sub = p.subcategories.get(subKey(g) ?? '') ?? 0;
  return clamp(own * 0.6 + color * 0.25 + sub * 0.15);
}

/** Una combinación valorada «contiene» a esta si incluye todas sus prendas principales. */
const contains = (sets: string[][], core: string[]) => core.length > 0 && sets.some((s) => core.every((id) => s.includes(id)));

export interface OutfitAffinity {
  /** -1..1 */
  value: number;
  likedMatch: boolean;
  dislikedMatch: boolean;
  /** Por qué, en lenguaje de la usuaria */
  detail: string;
}

/**
 * Afinidad de un conjunto. `coreIds` son sus prendas principales (arriba y abajo, o el vestido):
 * si coinciden con una combinación ya valorada, cuenta como la misma.
 */
export function outfitAffinity(p: FeedbackProfile, items: ProfileGarment[], coreIds: string[] = items.map((g) => g.id)): OutfitAffinity {
  const core = coreIds.map((id) => id.toLowerCase());
  const dislikedMatch = contains(p.dislikedSets, core);
  const likedMatch = !dislikedMatch && contains(p.likedSets, core);
  const per = items.map((g) => ({ g, a: garmentAffinity(p, g) }));
  const mean = per.length ? per.reduce((s, x) => s + x.a, 0) / per.length : 0;
  const value = clamp(mean + (likedMatch ? 0.5 : 0) - (dislikedMatch ? 1 : 0));

  const names = (xs: typeof per) => xs.map((x) => x.g.name || x.g.subcategory || 'una prenda').join(', ');
  const liked = per.filter((x) => x.a >= NOTABLE);
  const disliked = per.filter((x) => x.a <= -NOTABLE);
  const likedColors = [...new Set(items.map(colorKey).filter((k): k is string => Boolean(k) && (p.colors.get(k!) ?? 0) >= NOTABLE))];
  let detail: string;
  if (dislikedMatch) detail = 'Se parece a una combinación que valoraste como no agradable: te la proponemos menos.';
  else if (likedMatch) detail = 'Es una combinación que valoraste como agradable.';
  else if (disliked.length) detail = `Incluye prendas que no te agradaron en otras combinaciones: ${names(disliked)}.`;
  else if (liked.length) detail = `Incluye prendas que te agradaron: ${names(liked)}.`;
  else if (likedColors.length) detail = `Tiene colores que sueles valorar bien: ${likedColors.join(', ')}.`;
  else detail = p.size ? 'Aún no valoraste nada parecido.' : 'Aún no hay valoraciones.';
  return { value: Math.round(value * 100) / 100, likedMatch, dislikedMatch, detail };
}
