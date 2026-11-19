export type Undertone = 'Frio' | 'Calido' | 'Neutro';
export type ContrastLevel = 'Alto' | 'Medio' | 'Bajo';

export type ColorSeason =
  | 'Invierno Fuerte (Deep Winter)'
  | 'Invierno Frio (True Winter)'
  | 'Invierno Brillante (Clear Winter)'
  | 'Verano Suave (Soft Summer)'
  | 'Verano Frio (True Summer)'
  | 'Verano Claro (Light Summer)'
  | 'Otono Calido (True Autumn)'
  | 'Otono Fuerte (Deep Autumn)'
  | 'Otono Suave (Soft Autumn)'
  | 'Primavera Brillante (Clear Spring)'
  | 'Primavera Calida (True Spring)'
  | 'Primavera Clara (Light Spring)';

export type FaceShape =
  | 'Ovalado'
  | 'Cuadrado'
  | 'Corazon'
  | 'Diamante'
  | 'Redondo'
  | 'Rectangular';

export type BodyType =
  | 'Reloj de Arena (Hourglass)'
  | 'Triangulo / Pera'
  | 'Triangulo Invertido'
  | 'Rectangular / Atletica'
  | 'Oval / Manzana'
  | 'Pendiente de escaneo corporal';

export interface ColorSwatch {
  hex: string;
  name: string;
  category: 'base' | 'acento' | 'neutro';
  usageTip?: string;
}

export interface MunsellCoordinates {
  temperatureScore: number; // -100 (Ultra Frío) a +100 (Ultra Cálido)
  valueScore: number;       // 0 (Profundo/Oscuro) a 100 (Luminoso/Claro)
  chromaScore: number;      // 0 (Suave/Apagado) a 100 (Brillante/Puro)
  dominantDimension: 'Temperatura' | 'Profundidad' | 'Claridad' | 'Croma';
}

export interface ContrastMetric {
  deltaL: number;           // Diferencia de luminosidad entre piel y cabello/iris (0 a 100)
  level: 'Alto Contraste' | 'Contraste Medio' | 'Bajo Contraste';
  stylingRule: string;      // Color blocking vs Looks monocromáticos suaves
}

export interface ToxicColor {
  hex: string;
  name: string;
  negativeEffect: string;   // Explicación óptica de por qué resalta ojeras o apaga la piel
}

export interface ActionPalettes {
  baseWardrobe: ColorSwatch[]; // Fondos de armario: abrigos, trajes, pantalones
  powerColors: ColorSwatch[];  // Colores de impacto para reuniones y eventos
  beautyAndMetals: {
    lipsticks: string[];
    metals: ('Plata 925' | 'Oro Amarillo 18k' | 'Oro Blanco' | 'Oro Rosa' | 'Platino')[];
    glassesFrameColors: string[];
  };
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceContoursData {
  faceOval?: [number, number][];
  leftEyebrow?: [number, number][];
  rightEyebrow?: [number, number][];
  leftEye?: [number, number][];
  rightEye?: [number, number][];
  noseBridge?: [number, number][];
  noseBottom?: [number, number][];
  upperLip?: [number, number][];
  lowerLip?: [number, number][];
}

export interface RealLandmarksData {
  trichion: [number, number];
  glabella: [number, number];
  subnasale: [number, number];
  menton: [number, number];
  cheekLeft: [number, number];
  cheekRight: [number, number];
  jawLeft: [number, number];
  jawRight: [number, number];
  jawlineContour: [number, number][];
  eyeLeft?: [number, number];
  eyeRight?: [number, number];
  mouth?: [number, number];
  faceBox?: FaceBox;
  contours?: FaceContoursData;
  imageDimensions?: { width: number; height: number };
}

export interface BiometricMetricsData {
  lab?: { L: number; a: number; b: number };
  ita?: number;
  deltaL?: number;
  chroma?: number;
  faceLengthPx?: number;
  cheekboneWidthPx?: number;
  jawWidthPx?: number;
  jawAngleDeg?: number;
  lengthToWidthRatio?: number;
  thirds?: {
    superior: number;
    medio: number;
    inferior: number;
  };
  faceBox?: FaceBox;
}

export interface DiagnosticResult {
  id: string;
  timestamp: string;
  imageUri: string;
  skinTone: string;
  undertone: Undertone;
  season: ColorSeason;
  faceShape: FaceShape;
  bodyType?: BodyType;
  recommendedMetals: ('Plata' | 'Oro' | 'Oro Rosa')[];
  contrastLevel: ContrastLevel;
  palette: ColorSwatch[];
  facialSymmetry?: number;
  
  // Nuevos campos de colorimetría avanzada y landmarks reales de MediaPipe
  munsell?: MunsellCoordinates;
  contrastMetric?: ContrastMetric;
  toxicColors?: ToxicColor[];
  actionPalettes?: ActionPalettes;
  realLandmarks?: RealLandmarksData;
  biometricMetrics?: BiometricMetricsData;

  hairAdvice: {
    recommendedCuts: string[];
    recommendedShades: string[];
    avoidShades: string[];
  };
  glassesAdvice: {
    recommendedFrames: string[];
    avoidFrames: string[];
  };
  /** Textura del cabello que vio la IA (CLIP); ausente si la foto no la deja ver con seguridad */
  hairTexture?: { type: string; probability: number; care: string[] };
  /** Rasgos de ojos y labios medidos sobre la cara y consejos de maquillaje; ausente con la cara girada */
  beautyAdvice?: { traits: string[]; makeupTips: string[] };
}

