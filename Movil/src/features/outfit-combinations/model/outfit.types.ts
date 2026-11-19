import { OutfitFeedbackVote } from '@/entities/memory/model/types';

/**
 * HU-19 / HU-20 / HU-23: Contrato de `GET /api/wardrobe/outfits` (backend NestJS, módulo wardrobe).
 * Si cambia en `outfit-generator.service.ts`, actualizar aquí también.
 */

export type OutfitSeason = 'primavera' | 'verano' | 'otono' | 'invierno' | 'todo_el_ano';
export type OutfitOccasion = 'todas' | 'trabajo' | 'universidad' | 'evento' | 'diario' | 'deporte';
export type OutfitWeatherCondition = 'frio' | 'templado' | 'calido' | 'lluvia';

export type OutfitRole = 'superior' | 'inferior' | 'cuerpo_entero' | 'calzado' | 'abrigo';
export type OutfitType = 'dos_piezas' | 'cuerpo_entero';
export type OutfitHarmony =
  | 'base_neutra'
  | 'misma_familia'
  | 'contraste'
  | 'pieza_unica'
  | 'sin_datos';

export interface OutfitGarment {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  categoryLabel: string;
  color: string | null;
  colorHex: string | null;
  season: OutfitSeason | null;
  photoUrl: string | null;
  wearCount: number;
  lastWornAt: string | null;
}

export interface OutfitPiece {
  role: OutfitRole;
  roleLabel: string;
  item: OutfitGarment;
}

export interface GeneratedOutfit {
  id: string;
  type: OutfitType;
  pieces: OutfitPiece[];
  season: OutfitSeason | null;
  seasonLabel: string;
  harmony: OutfitHarmony;
  harmonyLabel: string;
  reason: string;
  /** HU-20: Ocasión recomendada para esta combinación */
  occasion?: OutfitOccasion;
  occasionLabel?: string;
  /** HU-23: Indica si la propuesta fue priorizada por valoraciones previas */
  isPrioritized?: boolean;
  prioritizedReason?: string;
  /** Puntuación 0-100 del motor de outfits del servidor (paleta, armonía, coherencia, ocasión, clima, Style DNA) */
  score?: number;
  /** Lo mejor resuelto del conjunto, en frases cortas */
  highlights?: string[];
  /** HU-22 / HU-23: Valoración actual registrada por la usuaria */
  userVote?: OutfitFeedbackVote | null;
}

export interface OutfitsResponse {
  isSufficient: boolean;
  insufficient: {
    title: string;
    message: string;
    missing: string[];
    ctaLabel: string;
  } | null;
  noMatches: {
    title: string;
    message: string;
    ctaLabel: string;
  } | null;
  summary: {
    totalConfirmed: number;
    tops: number;
    bottoms: number;
    onePieces: number;
    shoes: number;
    outerwear: number;
  };
  outfits: GeneratedOutfit[];
  generatedAt: string;
  /** HU-20: Ocasión seleccionada */
  occasion?: OutfitOccasion;
  occasionLabel?: string;
  /** HU-20: Condición climática aplicada si estaba disponible */
  weatherCondition?: OutfitWeatherCondition | null;
  weatherLabel?: string | null;
  /** HU-20 Criterio 3: Mensaje informativo cuando la información climática no estuvo disponible */
  weatherNotice?: string | null;
}

export interface OutfitQuery {
  season?: OutfitSeason;
  limit?: number;
  occasion?: OutfitOccasion;
  weatherCondition?: OutfitWeatherCondition;
  temperature?: number;
  likedGarmentIds?: string[];
  dislikedGarmentIds?: string[];
  likedColors?: string[];
  dislikedColors?: string[];
}
