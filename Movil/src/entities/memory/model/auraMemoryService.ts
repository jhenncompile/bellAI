import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuraMemoryState, OutfitFeedbackEntry, OutfitFeedbackVote } from './types';
import { GeneratedOutfit } from '@/features/outfit-combinations/model/outfit.types';

const AURA_MEMORY_KEY = '@aura_memory_state_v1';

const DEFAULT_MEMORY_STATE: AuraMemoryState = {
  entries: [],
  likedColors: [],
  rejectedColors: [],
  wornCountByGarment: {},
  archetypeAffinityModifiers: {
    Minimalista: 0,
    Clásico: 0,
    'Old Money': 0,
    Romántico: 0,
    Streetwear: 0,
    Dramático: 0,
  },
};

export class AuraMemoryService {
  static async clearMemory(): Promise<void> {
    await AsyncStorage.removeItem(AURA_MEMORY_KEY);
  }

  /**
   * Carga el estado completo de la memoria de estilo AURA
   */
  static async getMemory(): Promise<AuraMemoryState> {
    try {
      const raw = await AsyncStorage.getItem(AURA_MEMORY_KEY);
      if (!raw) return DEFAULT_MEMORY_STATE;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_MEMORY_STATE,
        ...parsed,
        archetypeAffinityModifiers: {
          ...DEFAULT_MEMORY_STATE.archetypeAffinityModifiers,
          ...(parsed.archetypeAffinityModifiers || {}),
        },
      };
    } catch (e) {
      console.warn('[AURA Memory] Error cargando memoria:', e);
      return DEFAULT_MEMORY_STATE;
    }
  }

  /**
   * Guarda el estado de la memoria
   */
  static async saveMemory(state: AuraMemoryState): Promise<void> {
    try {
      await AsyncStorage.setItem(AURA_MEMORY_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[AURA Memory] Error persistiendo memoria:', e);
    }
  }

  /**
   * HU-22: Registra una interacción de feedback sobre un atuendo (Like, Dislike, Worn)
   * Si la usuaria envía el mismo voto que ya existía, se desactiva (alterna).
   */
  static async recordFeedback(
    outfitId: string,
    vote: OutfitFeedbackVote,
    details: {
      topId?: string;
      bottomId?: string;
      topHexColor?: string;
      bottomHexColor?: string;
      score?: number;
      dominantStyle?: string;
      occasion?: string;
    } = {}
  ): Promise<AuraMemoryState> {
    const memory = await this.getMemory();

    const existingIndex = memory.entries.findIndex((e) => e.outfitId === outfitId);
    const existingEntry = existingIndex >= 0 ? memory.entries[existingIndex] : null;

    // Si la usuaria presiona de nuevo el mismo botón, se retira la valoración
    if (existingEntry && existingEntry.vote === vote) {
      memory.entries.splice(existingIndex, 1);
      await this.saveMemory(memory);
      return memory;
    }

    const newEntry: OutfitFeedbackEntry = {
      id: existingEntry ? existingEntry.id : `mem-${Date.now()}`,
      timestamp: new Date().toISOString(),
      outfitId,
      topId: details.topId || existingEntry?.topId,
      bottomId: details.bottomId || existingEntry?.bottomId,
      score: details.score || 75,
      vote,
      occasion: details.occasion,
    };

    // Actualizar o insertar reemplazando para evitar duplicados
    const remainingEntries = memory.entries.filter((e) => e.outfitId !== outfitId);
    memory.entries = [newEntry, ...remainingEntries.slice(0, 99)];

    // Actualización de colores aprobados o descartados
    const colorsToProcess = [details.topHexColor, details.bottomHexColor].filter(
      Boolean
    ) as string[];

    for (const color of colorsToProcess) {
      const hex = color.toUpperCase();
      if (vote === 'like' || vote === 'worn') {
        if (!memory.likedColors.includes(hex)) {
          memory.likedColors.push(hex);
        }
        memory.rejectedColors = memory.rejectedColors.filter((c) => c !== hex);
      } else if (vote === 'dislike') {
        if (!memory.rejectedColors.includes(hex)) {
          memory.rejectedColors.push(hex);
        }
        memory.likedColors = memory.likedColors.filter((c) => c !== hex);
      }
    }

    // Frecuencia de uso por prenda
    if (vote === 'worn') {
      if (details.topId) {
        memory.wornCountByGarment[details.topId] =
          (memory.wornCountByGarment[details.topId] || 0) + 1;
      }
      if (details.bottomId) {
        memory.wornCountByGarment[details.bottomId] =
          (memory.wornCountByGarment[details.bottomId] || 0) + 1;
      }
    }

    // Modificación de pesos de arquetipo
    if (
      details.dominantStyle &&
      memory.archetypeAffinityModifiers[details.dominantStyle] !== undefined
    ) {
      const delta = vote === 'like' ? 4 : vote === 'worn' ? 6 : -5;
      const current = memory.archetypeAffinityModifiers[details.dominantStyle];
      memory.archetypeAffinityModifiers[details.dominantStyle] = Math.max(
        -25,
        Math.min(30, current + delta)
      );
    }

    await this.saveMemory(memory);
    return memory;
  }

  /**
   * Obtiene la valoración actual registrada para un conjunto.
   */
  static async getOutfitVote(outfitId: string): Promise<OutfitFeedbackVote | null> {
    const memory = await this.getMemory();
    const entry = memory.entries.find((e) => e.outfitId === outfitId);
    return entry ? entry.vote : null;
  }

  /**
   * Obtiene un resumen estructurado de las valoraciones para enviar a los generadores de propuestas.
   */
  static async getFeedbackSummary(): Promise<{
    likedGarmentIds: string[];
    dislikedGarmentIds: string[];
    likedColors: string[];
    dislikedColors: string[];
  }> {
    const memory = await this.getMemory();
    const likedGarments = new Set<string>();
    const dislikedGarments = new Set<string>();

    for (const entry of memory.entries) {
      if (entry.vote === 'dislike') {
        if (entry.topId) dislikedGarments.add(entry.topId);
        if (entry.bottomId) dislikedGarments.add(entry.bottomId);
      } else if (entry.vote === 'like' || entry.vote === 'worn') {
        if (entry.topId) likedGarments.add(entry.topId);
        if (entry.bottomId) likedGarments.add(entry.bottomId);
      }
    }

    return {
      likedGarmentIds: Array.from(likedGarments),
      dislikedGarmentIds: Array.from(dislikedGarments),
      likedColors: memory.likedColors,
      dislikedColors: memory.rejectedColors,
    };
  }

  /**
   * HU-23: Ajusta las recomendaciones según las valoraciones previas de la usuaria.
   *
   * Criterios:
   * 1. Las prendas y combinaciones valoradas negativamente aparecen con menor frecuencia
   *    (penalización severa de prioridad para ubicarlas al final de la lista).
   * 2. Las características y prendas valoradas positivamente se priorizan en nuevas propuestas.
   */
  static async adjustOutfits(outfits: GeneratedOutfit[]): Promise<GeneratedOutfit[]> {
    const memory = await this.getMemory();
    const voteByOutfitId = new Map<string, OutfitFeedbackVote>();
    const dislikedGarments = new Set<string>();
    const likedGarments = new Set<string>();

    for (const entry of memory.entries) {
      if (entry.outfitId) {
        voteByOutfitId.set(entry.outfitId, entry.vote);
      }
      if (entry.vote === 'dislike') {
        if (entry.topId) dislikedGarments.add(entry.topId);
        if (entry.bottomId) dislikedGarments.add(entry.bottomId);
      } else if (entry.vote === 'like' || entry.vote === 'worn') {
        if (entry.topId) likedGarments.add(entry.topId);
        if (entry.bottomId) likedGarments.add(entry.bottomId);
      }
    }

    const dislikedColors = new Set(
      (memory.rejectedColors || []).map((c) => c.toUpperCase())
    );
    const likedColors = new Set(
      (memory.likedColors || []).map((c) => c.toUpperCase())
    );

    const scored = outfits.map((outfit) => {
      let scoreModifier = 0;
      const userVote = voteByOutfitId.get(outfit.id) || null;

      // 1. Voto directo de la combinación
      if (userVote === 'like') {
        scoreModifier += 60;
      } else if (userVote === 'dislike') {
        scoreModifier -= 80; // Las valoradas negativamente se relegan al final
      }

      // 2. Análisis por prenda y color
      let hasDislikedFeature = userVote === 'dislike';
      let hasLikedFeature = userVote === 'like';

      for (const piece of outfit.pieces) {
        const itemId = piece.item?.id;
        const colorHex = piece.item?.colorHex?.toUpperCase();

        if (itemId && dislikedGarments.has(itemId)) {
          scoreModifier -= 25;
          hasDislikedFeature = true;
        } else if (itemId && likedGarments.has(itemId)) {
          scoreModifier += 18;
          hasLikedFeature = true;
        }

        if (colorHex && dislikedColors.has(colorHex)) {
          scoreModifier -= 15;
          hasDislikedFeature = true;
        } else if (colorHex && likedColors.has(colorHex)) {
          scoreModifier += 15;
          hasLikedFeature = true;
        }
      }

      const isPrioritized =
        (hasLikedFeature || outfit.isPrioritized) &&
        !hasDislikedFeature &&
        userVote !== 'dislike';

      return {
        ...outfit,
        userVote,
        isPrioritized,
        prioritizedReason: isPrioritized
          ? outfit.prioritizedReason || 'Priorizada a partir de tus valoraciones previas'
          : undefined,
        _scoreModifier: scoreModifier,
      };
    });

    // Ordenar de mayor a menor modificador de valoración
    scored.sort((a, b) => b._scoreModifier - a._scoreModifier);

    return scored.map(({ _scoreModifier, ...rest }) => rest);
  }
}
