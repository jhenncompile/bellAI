import { AuraSilhouetteProfile, DEFAULT_SILHOUETTE_PROFILE, PoseLandmark } from './types';

/**
 * Calcula el perfil de silueta vectorial continuo basado en MediaPipe Pose (33 landmarks).
 * Reemplaza clasificaciones despectivas (pera, manzana) por 4 dimensiones euclidianas continuas.
 */
export class SilhouetteCalculator {
  /**
   * Dimensión 1: Verticalidad (0 a 100)
   * Formula: Distancia(Cresta Ilíaca, Tobillo) / Altura Total
   */
  static calculateVerticality(legRatio: number): number {
    // Escala normalizada: 0.44 (muy compacto) a 0.58 (muy elongado)
    const clamped = Math.max(0.44, Math.min(0.58, legRatio));
    return Math.round(((clamped - 0.44) / (0.58 - 0.44)) * 100);
  }

  /**
   * Dimensión 2: Curvatura (0 a 100)
   * Formula: WHR (Waist-to-Hip Ratio)
   */
  static calculateCurvature(whr: number): number {
    // Escala normalizada inversa: WHR 0.65 es curvatura máxima (100), WHR 0.88 es lineal (0)
    const clamped = Math.max(0.65, Math.min(0.88, whr));
    return Math.round(((0.88 - clamped) / (0.88 - 0.65)) * 100);
  }

  /**
   * Dimensión 3: Angularidad (0 a 100)
   * Formula: Ángulo clavícula/acromion respecto a la horizontal
   */
  static calculateAngularity(shoulderAngleDegrees: number): number {
    // 90° es hombro perfectamente horizontal y anguloso (100), 115° es caído/redondeado (0)
    const clamped = Math.max(90, Math.min(115, shoulderAngleDegrees));
    return Math.round(((115 - clamped) / (115 - 90)) * 100);
  }

  /**
   * Dimensión 4: Balance Hombros vs Caderas (0 a 100)
   * Formula: Ancho Hombros / Ancho Caderas (Ratio Biacromial)
   * 0 = Hombros muy predominantes, 50 = Equilibrado (1.0), 100 = Caderas predominantes
   */
  static calculateBalance(biacromialRatio: number): number {
    // 1.25 -> 0 (hombros dominantes), 1.0 -> 50, 0.80 -> 100 (caderas dominantes)
    if (biacromialRatio >= 1.0) {
      const clamped = Math.min(1.25, biacromialRatio);
      return Math.round(50 - ((clamped - 1.0) / (1.25 - 1.0)) * 50);
    } else {
      const clamped = Math.max(0.80, biacromialRatio);
      return Math.round(50 + ((1.0 - clamped) / (1.0 - 0.80)) * 50);
    }
  }

  /**
   * Genera el perfil de silueta completo con insights arquitectónicos
   */
  static computeProfileFromMeasurements(
    legRatio: number,
    whr: number,
    shoulderAngle: number,
    biacromialRatio: number
  ): AuraSilhouetteProfile {
    const verticality = this.calculateVerticality(legRatio);
    const curvature = this.calculateCurvature(whr);
    const angularity = this.calculateAngularity(shoulderAngle);
    const balance = this.calculateBalance(biacromialRatio);

    const insights: string[] = [];

    // Insights de Verticalidad
    if (verticality > 65) {
      insights.push(
        `Línea vertical prolongada (${legRatio * 100}% de estatura en piernas). Favorecen cortes monocromáticos largos y tiros medios que preserven la fluidez continua.`
      );
    } else if (verticality < 45) {
      insights.push(
        `Silueta compacta (${legRatio * 100}% piernas). El tiro alto y el corte a la cintura elevan el centro de gravedad visual.`
      );
    } else {
      insights.push(
        `Proporción vertical equilibrada (${legRatio * 100}% piernas). Gran versatilidad en largos de abrigos y tiro de pantalones.`
      );
    }

    // Insights de Curvatura
    if (curvature > 70) {
      insights.push(
        `Alta curvatura estructural (WHR ${whr.toFixed(2)}). Las prendas que definen o abrazan la cintura evitan el efecto carpa y potencian tu proporción áurea.`
      );
    } else if (curvature < 40) {
      insights.push(
        `Estructura lineal atlética (WHR ${whr.toFixed(2)}). Favorecen cortes rectos, solapas arquitectónicas, prendas estructuradas y capas verticales.`
      );
    } else {
      insights.push(
        `Curvatura moderada (WHR ${whr.toFixed(2)}). Admite tanto cortes fluidos como piezas sutilmente entalladas.`
      );
    }

    // Insights de Balance de Hombros y Caderas
    if (balance < 40) {
      insights.push(
        `Línea de hombros predominante (Ratio ${biacromialRatio.toFixed(2)}). Favorecen escotes en V y volumen en la parte inferior (pantalones anchos, faldas en A) para equilibrar.`
      );
    } else if (balance > 60) {
      insights.push(
        `Base inferior predominante (Ratio ${biacromialRatio.toFixed(2)}). Escotes barco, solapas y mangas estructuradas amplían visualmente el torso superior.`
      );
    } else {
      insights.push(
        `Simetría torácico-pélvica (Ratio ${biacromialRatio.toFixed(2)}). Proporción armónica 1:1 entre hombros y caderas.`
      );
    }

    return {
      verticality,
      curvature,
      angularity,
      balance,
      whr,
      legRatio,
      biacromialRatio,
      shoulderAngle,
      insights,
    };
  }

  /**
   * Perfil por defecto con calibración morfológica
   */
  static getDefaultProfile(): AuraSilhouetteProfile {
    return DEFAULT_SILHOUETTE_PROFILE;
  }
}
