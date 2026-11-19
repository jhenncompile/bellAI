import { AuraSilhouetteProfile } from '@/entities/silhouette/model/types';
import { AestheticVector } from '@/entities/aesthetic/model/types';
import { RuleEvaluation } from '@/entities/style-rules/model/types';

export type AuraVibe =
  | 'Clean Girl Aesthetic'
  | 'Old Money Chic'
  | 'Dark Academia'
  | 'Y2K Glam'
  | 'Quiet Luxury'
  | 'Cyberpunk Edge'
  | 'Soft Romantic'
  | 'Casual Urbano'
  | 'Smart Casual'
  | 'Minimalista Contemporáneo'
  | 'Avant-Garde / Bold'
  | 'Soft Romance';

export interface VisualError {
  id: string;
  title: string;
  penaltyPoints: number; // Negativo, ej: -8
  fixRecommendation: string;
  category: 'color' | 'contraste' | 'corte' | 'proporciones';
  potentialGain: number; // Positivo, ej: +8
}

export interface CelebrityMatch {
  name: string;
  matchPercentage: number;
  sharedFeatures: string;
  imagePlaceholderUrl?: string;
}

export interface AuraAuditData {
  baseScore: number;          // Siempre 100
  totalPenalties: number;     // Suma de puntos restados
  totalBonuses: number;       // Suma de puntos sumados
  projectedScore: number;     // Puntuación alcanzable al corregir errores
  projectedTierLabel: string; // Ej: "Nivel Óptimo"
}

export interface AuraScoreData {
  totalScore: number; // 0 a 100
  tierLabel: string;
  breakdown: {
    colorHarmonization: number; // 35%
    facialSymmetry: number;     // 15% (Enmarque y simetría de rasgos)
    proportionsBalance: number; // 30% (Balance de silueta y proporciones)
    contrastCoherence: number;  // 20% (Coherencia estética y contraste)
    
    // Alias directos para mayor claridad del Nivel 2
    silhouetteBalance?: number;  // 30%
    aestheticCoherence?: number; // 20%
    facialFraming?: number;      // 15%
  };
  audit: AuraAuditData;
  auraVibe: AuraVibe;
  topVisualErrors: VisualError[];
  celebrityMatch: CelebrityMatch;
  silhouetteProfile?: AuraSilhouetteProfile;
  aestheticVector?: AestheticVector;
  ruleEvaluations?: RuleEvaluation[];
  glowUpPlan: {
    step1: string;
    step2: string;
    step3: string;
  };
}
