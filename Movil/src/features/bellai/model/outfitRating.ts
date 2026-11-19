import type { FeedbackValue, OutfitRating } from '../api/types';

/**
 * HU-22: las combinaciones se valoran como agradable, neutral o no agradable. Se usa el mismo
 * control de valoración que el resto de la app (pulgar arriba, neutral, pulgar abajo).
 */
export const RATING_LABEL: Record<OutfitRating, string> = {
  agradable: 'Agradable',
  neutral: 'Neutral',
  no_agradable: 'No agradable',
};

export const RATING_TO_FEEDBACK: Record<OutfitRating, FeedbackValue> = {
  agradable: 'me_gusta',
  neutral: 'neutral',
  no_agradable: 'no_me_gusta',
};

export const FEEDBACK_TO_RATING: Record<FeedbackValue, OutfitRating> = {
  me_gusta: 'agradable',
  neutral: 'neutral',
  no_me_gusta: 'no_agradable',
};

/** Clave de una combinación por sus prendas (sin importar el orden), para saber si ya está guardada. */
export function itemSetKey(itemIds: string[]): string {
  return [...new Set(itemIds.map((id) => id.toLowerCase()))].sort().join(',');
}

/**
 * HU-23: identificador corto y estable de una combinación sin guardar, para registrar su valoración
 * en la cuenta (`/style/feedback` admite hasta 120 caracteres). Dos hash de 32 bits sobre la clave.
 */
export function comboFeedbackId(itemIds: string[]): string {
  const key = itemSetKey(itemIds);
  let a = 5381;
  let b = 0;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    a = ((a << 5) + a + ch) >>> 0;
    b = (ch + (b << 6) + (b << 16) - b) >>> 0;
  }
  return `combo-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
