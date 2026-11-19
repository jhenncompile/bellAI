import { Garment } from '@/entities/wardrobe/model/types';
import { StyleRuleEngine } from '@/entities/style-rules/model/StyleRuleEngine';
import { GarmentAttributes } from '@/entities/style-rules/model/types';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { SilhouetteCalculator } from '@/entities/silhouette/model/silhouetteCalculator';
import { fetchWardrobeItems } from '../api/wardrobeService';
import { AuraMemoryService } from '@/entities/memory/model/auraMemoryService';

export interface GeneratedOutfit {
  id: string;
  title: string;
  occasion: 'Oficina / Trabajo' | 'Casual Chic' | 'Cena / Evento';
  score: number;
  top: Garment;
  bottom: Garment;
  shoes?: Garment;
  outerwear?: Garment;
  vibe: string;
  rationale: string;
  ruleHighlights: string[];
}

export class OutfitGeneratorService {
  /**
   * Genera combinaciones óptimas de outfits basadas EXCLUSIVAMENTE
   * en las prendas reales que la usuaria tiene digitalizadas en su AURA Closet (Pilar 14)
   * y ajustadas según sus valoraciones previas (HU-23).
   */
  static async generateOutfits(diagnostic: DiagnosticResult): Promise<GeneratedOutfit[]> {
    const garments = await fetchWardrobeItems();

    const tops = garments.filter((g) => g.category === 'Superior');
    const bottoms = garments.filter((g) => g.category === 'Inferior');
    const shoes = garments.filter((g) => g.category === 'Calzado');
    const coats = garments.filter((g) => g.category === 'Abrigo');

    if (tops.length === 0 || bottoms.length === 0) {
      return [];
    }

    const silhouette = SilhouetteCalculator.getDefaultProfile();
    const candidates: GeneratedOutfit[] = [];

    // Cargar memoria de valoraciones para HU-23
    const memory = await AuraMemoryService.getMemory();
    const dislikedGarments = new Set(
      memory.entries
        .filter((e) => e.vote === 'dislike')
        .flatMap((e) => [e.topId, e.bottomId])
        .filter(Boolean) as string[]
    );
    const likedGarments = new Set(
      memory.entries
        .filter((e) => e.vote === 'like')
        .flatMap((e) => [e.topId, e.bottomId])
        .filter(Boolean) as string[]
    );
    const dislikedColors = new Set(memory.rejectedColors.map((c) => c.toUpperCase()));
    const likedColors = new Set(memory.likedColors.map((c) => c.toUpperCase()));

    // Cruzar combinaciones reales top x bottom
    for (const top of tops) {
      for (const bottom of bottoms) {
        // Mapear a atributos evaluables para el motor de reglas
        const topAttr: GarmentAttributes = {
          id: top.id,
          name: top.name,
          category: 'top',
          neckline: top.name.toLowerCase().includes('camisa') ? 'v_neck' : 'crew',
          fit: 'tailored',
          structure: top.name.toLowerCase().includes('blazer') ? 'rigid' : 'soft',
          colorHex: top.primaryColorHex,
          temperature:
            top.seasonMatch === 'Armonia Total'
              ? diagnostic.undertone === 'Frio'
                ? 'frio'
                : 'calido'
              : 'calido',
          contrastLevel: 'alto',
        };

        const bottomAttr: GarmentAttributes = {
          id: bottom.id,
          name: bottom.name,
          category: 'bottom',
          waistRise: 'mid',
          fit: 'tailored',
          structure: 'rigid',
          colorHex: bottom.primaryColorHex,
          temperature: 'neutro',
          contrastLevel: 'alto',
        };

        const evaluation = StyleRuleEngine.evaluateCompleteOutfit(
          silhouette,
          diagnostic.undertone,
          diagnostic.contrastLevel,
          diagnostic.faceShape,
          topAttr,
          bottomAttr
        );

        // HU-23: Ajuste de puntuación según valoraciones previas
        let adjustedScore = evaluation.totalScore;
        if (dislikedGarments.has(top.id) || dislikedGarments.has(bottom.id)) {
          adjustedScore -= 20; // Penalización a prendas valoradas negativamente
        }
        if (likedGarments.has(top.id) || likedGarments.has(bottom.id)) {
          adjustedScore += 15; // Priorización a prendas valoradas positivamente
        }
        const topHex = top.primaryColorHex?.toUpperCase();
        const bottomHex = bottom.primaryColorHex?.toUpperCase();
        if ((topHex && dislikedColors.has(topHex)) || (bottomHex && dislikedColors.has(bottomHex))) {
          adjustedScore -= 10;
        }
        if ((topHex && likedColors.has(topHex)) || (bottomHex && likedColors.has(bottomHex))) {
          adjustedScore += 10;
        }

        // Asignar ocasión coherente
        const isFormal =
          top.name.toLowerCase().includes('blazer') ||
          top.name.toLowerCase().includes('sastre');
        const occasion = isFormal
          ? 'Oficina / Trabajo'
          : candidates.length % 2 === 0
          ? 'Casual Chic'
          : 'Cena / Evento';
        const vibe = isFormal ? 'Old Money Chic' : 'Clean Girl Aesthetic';

        const highlights = evaluation.evaluations
          .filter((e) => e.passed)
          .map((e) => e.reason)
          .slice(0, 2);

        candidates.push({
          id: `outfit-${top.id}-${bottom.id}`,
          title: `${top.name} + ${bottom.name}`,
          occasion,
          score: adjustedScore,
          top,
          bottom,
          shoes: shoes[0],
          outerwear: coats[0],
          vibe,
          rationale: `Equilibrio del ${adjustedScore}%: ${top.tips}`,
          ruleHighlights: highlights,
        });
      }
    }

    // Ordenar de mayor a menor puntuación y retornar los mejores
    return candidates.sort((a, b) => b.score - a.score).slice(0, 4);
  }
}
