export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface AuraSilhouetteProfile {
  verticality: number;     // 0 (Compacta) a 100 (Alta presencia vertical)
  curvature: number;       // 0 (Línea recta / atlética) a 100 (Alta curvatura / reloj de arena)
  angularity: number;      // 0 (Líneas suaves / redondeadas) a 100 (Estructura ósea marcada)
  balance: number;         // 0 (Hombros predominantes) a 50 (Equilibrado) a 100 (Caderas predominantes)
  whr: number;             // Waist-to-Hip Ratio (ej: 0.71)
  legRatio: number;        // Distancia pierna / Altura total (ej: 0.54)
  biacromialRatio: number; // Ancho hombros / Ancho caderas (ej: 1.02)
  shoulderAngle: number;   // Ángulo acromion respecto a la horizontal (grados, ej: 91°)
  insights: string[];      // Análisis arquitectónico sin motes ofensivos
}

export const DEFAULT_SILHOUETTE_PROFILE: AuraSilhouetteProfile = {
  verticality: 62,
  curvature: 78,
  angularity: 65,
  balance: 52,
  whr: 0.72,
  legRatio: 0.54,
  biacromialRatio: 1.02,
  shoulderAngle: 91,
  insights: [
    'Presencia vertical media-alta: relación de longitud de piernas del 54% respecto a la estatura total.',
    'Curvatura definida (WHR 0.72): el punto focal natural se sitúa en la cintura media.',
    'Estructura ósea equilibrada: ratio hombros-cadera de 1.02, permitiendo simetría en cortes tanto rectos como envolventes.',
  ],
};
