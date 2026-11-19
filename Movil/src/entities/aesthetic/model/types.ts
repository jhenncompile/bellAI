export type AestheticArchetype =
  | 'Minimalista'
  | 'Clásico'
  | 'Old Money'
  | 'Romántico'
  | 'Streetwear'
  | 'Dramático';

export interface AestheticVector {
  minimalista: number; // Porcentaje (0 a 100)
  clasico: number;     // Porcentaje (0 a 100)
  oldMoney: number;    // Porcentaje (0 a 100)
  romantico: number;   // Porcentaje (0 a 100)
  streetwear: number;  // Porcentaje (0 a 100)
  dramatico: number;   // Porcentaje (0 a 100)
  dominantArchetype: AestheticArchetype;
  secondaryArchetype: AestheticArchetype;
  confidenceScore: number;
  sourcesBreakdown: {
    onboardingWeight: number; // 40%
    morphologyWeight: number; // 30%
    wardrobeWeight: number;   // 30%
  };
  description: string;
}

export const DEFAULT_AESTHETIC_VECTOR: AestheticVector = {
  minimalista: 22,
  clasico: 26,
  oldMoney: 34,
  romantico: 8,
  streetwear: 6,
  dramatico: 4,
  dominantArchetype: 'Old Money',
  secondaryArchetype: 'Clásico',
  confidenceScore: 92,
  sourcesBreakdown: {
    onboardingWeight: 40,
    morphologyWeight: 30,
    wardrobeWeight: 30,
  },
  description:
    'Fusión de elegancia estructurada (Old Money & Clásico) con toques de sobriedad moderna (Minimalista). Tu ADN de estilo privilegia sastrería atemporal, tejidos nobles y cortes limpios.',
};
