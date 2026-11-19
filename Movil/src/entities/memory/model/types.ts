export type OutfitFeedbackVote = 'like' | 'dislike' | 'worn';

export interface OutfitFeedbackEntry {
  id: string;
  timestamp: string;
  outfitId: string;
  topId?: string;
  bottomId?: string;
  score: number;
  vote: OutfitFeedbackVote;
  occasion?: string;
  userNotes?: string;
}

export interface AuraMemoryState {
  entries: OutfitFeedbackEntry[];
  likedColors: string[];       // HEX de colores que la usuaria aprueba
  rejectedColors: string[];    // HEX de colores que la usuaria rechaza o descarta
  wornCountByGarment: Record<string, number>; // Cuántas veces se usó cada prenda
  archetypeAffinityModifiers: Record<string, number>; // Modificadores dinámicos (-20 a +30)
}
