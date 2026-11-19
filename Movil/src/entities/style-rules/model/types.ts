import { AuraSilhouetteProfile } from '@/entities/silhouette/model/types';
import { Undertone, ContrastLevel, FaceShape } from '@/entities/diagnostic/model/types';

export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'footwear' | 'accessory';
export type NecklineType = 'v_neck' | 'crew' | 'turtleneck' | 'boat' | 'sweetheart' | 'square';
export type WaistRiseType = 'high' | 'mid' | 'low';
export type GarmentFit = 'oversized' | 'fitted' | 'tailored' | 'relaxed';
export type GarmentStructure = 'soft' | 'rigid';
export type ColorTemperature = 'frio' | 'calido' | 'neutro';

export interface GarmentAttributes {
  id: string;
  name: string;
  category: GarmentCategory;
  neckline?: NecklineType;
  waistRise?: WaistRiseType;
  fit: GarmentFit;
  structure: GarmentStructure;
  colorHex: string;
  temperature: ColorTemperature;
  contrastLevel: 'alto' | 'medio' | 'bajo';
}

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  scoreDelta: number; // Negativo para penalizaciones (ej: -8), positivo para bonificaciones (+7)
  reason: string;     // Explicación causal exacta
  pillar: 'color' | 'silueta' | 'estetica' | 'rasgos';
  remedy?: string;    // Acción correctiva de Glow-Up
  potentialPointsGain: number;
}

export interface OutfitEvaluationResult {
  totalScore: number;
  evaluations: RuleEvaluation[];
  passedCount: number;
  penaltiesCount: number;
  totalPenalties: number;
  totalBonuses: number;
  projectedScoreIfFixed: number;
  pillarBreakdown: {
    colorHarmonization: number; // 35%
    silhouetteBalance: number;  // 30%
    aestheticCoherence: number; // 20%
    facialFraming: number;      // 15%
  };
}
