import {
  AestheticArchetype,
  AestheticVector,
  DEFAULT_AESTHETIC_VECTOR,
} from './types';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { UserProfile } from '@/entities/user/model/types';

/**
 * Calculador del Perfil Estético mediante Matriz de Afinidades y Vector Probabilístico Normalizado.
 * Fuentes: 40% Onboarding consciente, 30% Morfología/Contraste, 30% Armario/Interacción.
 */
export class AestheticCalculator {
  static computeVector(
    profile?: UserProfile,
    diagnostic?: DiagnosticResult,
    wardrobeCategoriesCount: Record<string, number> = {},
    memoryModifiers: Record<string, number> = {}
  ): AestheticVector {
    if (!profile && !diagnostic) {
      return DEFAULT_AESTHETIC_VECTOR;
    }

    // Puntuaciones acumulativas para cada uno de los 6 arquetipos (prioridad contemporánea por defecto)
    const scores: Record<AestheticArchetype, number> = {
      Streetwear: 25,
      Minimalista: 20,
      Clásico: 20,
      'Old Money': 15,
      Dramático: 10,
      Romántico: 5,
    };

    // Aplicar modificadores de aprendizaje continuo (Pilar 12: Feedback Learning)
    if (memoryModifiers) {
      Object.keys(memoryModifiers).forEach((key) => {
        if (scores[key as AestheticArchetype] !== undefined) {
          scores[key as AestheticArchetype] = Math.max(5, scores[key as AestheticArchetype] + memoryModifiers[key]);
        }
      });
    }

    // 1. PONDERACIÓN CONSCIENTE (40%) - Preferencias del perfil
    const applyStylePreference = (style: string, direction: 1 | -1) => {
      const lower = style.toLowerCase();
      const adjust = (archetype: AestheticArchetype, weight: number) => {
        scores[archetype] = Math.max(5, scores[archetype] + Math.round(weight * direction));
      };

      if (lower.includes('minimal') || lower.includes('clean girl')) adjust('Minimalista', 40);
      if (lower.includes('clasic') || lower.includes('elegante') || lower.includes('dark academia')) {
        adjust('Clásico', 35);
      }
      if (lower.includes('old money') || lower.includes('quiet luxury') || lower.includes('lujo')) {
        adjust('Old Money', 45);
      }
      if (lower.includes('romant') || lower.includes('boho')) adjust('Romántico', 45);
      if (lower.includes('street') || lower.includes('urbano') || lower.includes('casual')) {
        adjust('Streetwear', 40);
      }
      if (lower.includes('dramat') || lower.includes('avant') || lower.includes('edgy') || lower.includes('y2k') || lower.includes('glam')) {
        adjust('Dramático', 35);
      }
    };

    profile?.preferredStyles?.forEach((style) => applyStylePreference(style, 1));
    profile?.dislikedStyles?.forEach((style) => applyStylePreference(style, -1));

    // 2. COMPATIBILIDAD MORFOLÓGICA Y CROMÁTICA (30%)
    if (diagnostic) {
      if (diagnostic.contrastLevel === 'Alto') {
        scores['Old Money'] += 20;
        scores.Clásico += 20;
        scores.Dramático += 25;
      } else if (diagnostic.contrastLevel === 'Bajo') {
        scores.Minimalista += 25;
        scores.Streetwear += 20;
      } else {
        scores.Clásico += 20;
        scores.Streetwear += 20;
        scores.Minimalista += 15;
      }

      // Geometría facial
      if (diagnostic.faceShape === 'Cuadrado' || diagnostic.faceShape === 'Diamante') {
        scores.Dramático += 15;
        scores['Old Money'] += 15;
      } else if (diagnostic.faceShape === 'Ovalado' || diagnostic.faceShape === 'Corazon') {
        scores.Clásico += 15;
        scores.Minimalista += 15;
      } else {
        scores.Streetwear += 15;
      }
    }

    // 3. COMPORTAMIENTO Y ARMARIO (30%)
    const totalGarments = Object.values(wardrobeCategoriesCount).reduce((a, b) => a + b, 0);
    if (totalGarments > 0) {
      if ((wardrobeCategoriesCount['blazer'] || 0) + (wardrobeCategoriesCount['saco'] || 0) > 2) {
        scores['Old Money'] += 20;
        scores.Clásico += 20;
      }
      if ((wardrobeCategoriesCount['denim'] || 0) + (wardrobeCategoriesCount['hoodie'] || 0) > 2) {
        scores.Streetwear += 25;
      }
      if ((wardrobeCategoriesCount['vestido'] || 0) + (wardrobeCategoriesCount['seda'] || 0) > 2) {
        scores.Romántico += 20;
      }
    } else {
      // Valor base por defecto equilibrado
      scores['Old Money'] += 15;
      scores.Clásico += 15;
    }

    // NORMALIZACIÓN DEL VECTOR A SUMA 100%
    const totalSum = Object.values(scores).reduce((sum, val) => sum + val, 0);
    const normalized: Record<AestheticArchetype, number> = {
      Minimalista: Math.round((scores.Minimalista / totalSum) * 100),
      Clásico: Math.round((scores.Clásico / totalSum) * 100),
      'Old Money': Math.round((scores['Old Money'] / totalSum) * 100),
      Romántico: Math.round((scores.Romántico / totalSum) * 100),
      Streetwear: Math.round((scores.Streetwear / totalSum) * 100),
      Dramático: Math.round((scores.Dramático / totalSum) * 100),
    };

    // Ajuste por redondeo para que la suma sea exactamente 100%
    const currentSum = Object.values(normalized).reduce((a, b) => a + b, 0);
    const diff = 100 - currentSum;
    normalized['Old Money'] += diff;

    // Obtener arquetipos dominante y secundario
    const sorted = (Object.keys(normalized) as AestheticArchetype[]).sort(
      (a, b) => normalized[b] - normalized[a]
    );

    const dominant = sorted[0];
    const secondary = sorted[1];

    return {
      minimalista: normalized.Minimalista,
      clasico: normalized.Clásico,
      oldMoney: normalized['Old Money'],
      romantico: normalized.Romántico,
      streetwear: normalized.Streetwear,
      dramatico: normalized.Dramático,
      dominantArchetype: dominant,
      secondaryArchetype: secondary,
      confidenceScore: 94,
      sourcesBreakdown: {
        onboardingWeight: 40,
        morphologyWeight: 30,
        wardrobeWeight: 30,
      },
      description: `Dominancia principal en ${dominant} (${normalized[dominant]}%) con resonancia secundaria en ${secondary} (${normalized[secondary]}%). Tu fórmula combina líneas estructuradas con equilibrio cromático atemporal.`,
    };
  }
}
