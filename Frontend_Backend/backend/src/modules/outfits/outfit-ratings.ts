/** HU-22: valoración de una combinación guardada (columna `outfit.valoracion`). */
export const OUTFIT_RATINGS = ['agradable', 'neutral', 'no_agradable'] as const;
export type OutfitRating = (typeof OUTFIT_RATINGS)[number];

/** Equivalencia con la valoración general de `/style/feedback`, que alimenta el Style DNA (HU-23). */
export const RATING_TO_FEEDBACK: Record<OutfitRating, 'me_gusta' | 'neutral' | 'no_me_gusta'> = {
  agradable: 'me_gusta',
  neutral: 'neutral',
  no_agradable: 'no_me_gusta',
};

/**
 * Clave de un conjunto de prendas, sin importar el orden ni las repetidas: dos combinaciones
 * con las mismas prendas son la misma y no se guardan dos veces.
 */
export function itemSetKey(itemIds: string[]): string {
  return [...new Set(itemIds.map((id) => id.toLowerCase()))].sort().join(',');
}
