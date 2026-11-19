import {
  GarmentAttributes,
  OutfitEvaluationResult,
  RuleEvaluation,
} from './types';
import { AuraSilhouetteProfile } from '@/entities/silhouette/model/types';
import { Undertone, ContrastLevel, FaceShape } from '@/entities/diagnostic/model/types';

/**
 * StyleRuleEngine: Sistema Experto Determinista de Reglas de Moda y Armonía Visual.
 * Basado en:
 * 1. Compensación Visual de Rudolf Arnheim (pesos visuales y centros de gravedad).
 * 2. Armonía Cromática de Johannes Itten (contrastes y temperaturas).
 * 3. Proporción Áurea (relaciones de tiro y elongación).
 */
export class StyleRuleEngine {
  /**
   * Regla 1: Compensación de Verticalidad (Silueta vs Tiro de Prenda Inferior)
   */
  static evaluateVerticality(
    silhouette: AuraSilhouetteProfile,
    bottom?: GarmentAttributes
  ): RuleEvaluation {
    if (!bottom || bottom.category !== 'bottom') {
      return {
        ruleId: 'rule-vert-0',
        ruleName: 'Verticalidad Neutra',
        passed: true,
        scoreDelta: 0,
        reason: 'Sin prenda inferior definida.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    if (silhouette.verticality < 45 && bottom.waistRise === 'low') {
      return {
        ruleId: 'rule-vert-1',
        ruleName: 'Compensación de Verticalidad',
        passed: false,
        scoreDelta: -8,
        reason: 'El tiro bajo acorta visualmente la línea de las piernas en siluetas compactas.',
        pillar: 'silueta',
        remedy: 'Cambiar a pantalón de tiro medio o alto (+8 pts)',
        potentialPointsGain: 8,
      };
    }

    if (silhouette.verticality < 45 && bottom.waistRise === 'high') {
      return {
        ruleId: 'rule-vert-2',
        ruleName: 'Elongación de Verticalidad',
        passed: true,
        scoreDelta: +7,
        reason: 'El tiro alto eleva el centro de gravedad visual, elongando la figura.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    if (silhouette.verticality > 65 && bottom.waistRise === 'high') {
      return {
        ruleId: 'rule-vert-3',
        ruleName: 'Proporción Vertical Elongada',
        passed: true,
        scoreDelta: +5,
        reason: 'Acompaña la verticalidad natural sin quebrar la silueta.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    return {
      ruleId: 'rule-vert-4',
      ruleName: 'Verticalidad Equilibrada',
      passed: true,
      scoreDelta: +3,
      reason: 'Proporción equilibrada entre tiro y longitud de piernas.',
      pillar: 'silueta',
      potentialPointsGain: 0,
    };
  }

  /**
   * Regla 2: Coherencia de Temperatura Cromática (Subtono vs Temperatura de Prenda)
   */
  static evaluateColorTemperature(
    userUndertone: Undertone,
    garment?: GarmentAttributes
  ): RuleEvaluation {
    if (!garment) {
      return {
        ruleId: 'rule-temp-0',
        ruleName: 'Temperatura Neutra',
        passed: true,
        scoreDelta: 0,
        reason: 'Prenda sin clasificar.',
        pillar: 'color',
        potentialPointsGain: 0,
      };
    }

    const isGarmentCool = garment.temperature === 'frio';
    const isGarmentWarm = garment.temperature === 'calido';

    if (userUndertone === 'Frio' && isGarmentWarm) {
      return {
        ruleId: 'rule-temp-1',
        ruleName: 'Choque Térmico Subdérmico',
        passed: false,
        scoreDelta: -10,
        reason:
          'Esta prenda proyecta sombras amarillentas y cetrinas sobre piel de subtono frío.',
        pillar: 'color',
        remedy: 'Sustituir por tono frío (azul zafiro, esmeralda, gris perla) (+10 pts)',
        potentialPointsGain: 10,
      };
    }

    if (userUndertone === 'Calido' && isGarmentCool) {
      return {
        ruleId: 'rule-temp-2',
        ruleName: 'Desaturación Térmica',
        passed: false,
        scoreDelta: -10,
        reason:
          'El tono frío apaga la luminosidad dorada de tu piel cálida, haciéndola lucir grisácea.',
        pillar: 'color',
        remedy: 'Sustituir por tono cálido (camel, terracota, mostaza suave) (+10 pts)',
        potentialPointsGain: 10,
      };
    }

    if (
      (userUndertone === 'Frio' && isGarmentCool) ||
      (userUndertone === 'Calido' && isGarmentWarm)
    ) {
      return {
        ruleId: 'rule-temp-3',
        ruleName: 'Armonía Térmica Perfecta',
        passed: true,
        scoreDelta: +10,
        reason: 'Color en plena armonía biológica con tu subtono de piel.',
        pillar: 'color',
        potentialPointsGain: 0,
      };
    }

    return {
      ruleId: 'rule-temp-4',
      ruleName: 'Tono Neutro Compatible',
      passed: true,
      scoreDelta: +4,
      reason: 'El tono neutro se adapta fluidamente a tu pigmentación.',
      pillar: 'color',
      potentialPointsGain: 0,
    };
  }

  /**
   * Regla 3: Compensación de Hombros y Escotes (Rudolf Arnheim)
   */
  static evaluateShoulderBalance(
    silhouette: AuraSilhouetteProfile,
    top?: GarmentAttributes
  ): RuleEvaluation {
    if (!top || (top.category !== 'top' && top.category !== 'dress')) {
      return {
        ruleId: 'rule-shld-0',
        ruleName: 'Balance de Hombros',
        passed: true,
        scoreDelta: 0,
        reason: 'Sin escote evaluable.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    // Hombros anchos / dominantes (Balance < 40)
    if (silhouette.balance < 40 && top.neckline === 'boat') {
      return {
        ruleId: 'rule-shld-1',
        ruleName: 'Sobrecarga Horizontal Torácica',
        passed: false,
        scoreDelta: -6,
        reason:
          'El escote barco añade amplitud horizontal a una línea de hombros ya predominante.',
        pillar: 'silueta',
        remedy: 'Cambiar a escote en V o escote asimétrico (+6 pts)',
        potentialPointsGain: 6,
      };
    }

    if (silhouette.balance < 40 && top.neckline === 'v_neck') {
      return {
        ruleId: 'rule-shld-2',
        ruleName: 'Descompresión Vertical',
        passed: true,
        scoreDelta: +6,
        reason: 'El escote en V rompe la horizontalidad y estiliza el cuello y clavículas.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    // Caderas dominantes (Balance > 60)
    if (silhouette.balance > 60 && top.neckline === 'boat') {
      return {
        ruleId: 'rule-shld-3',
        ruleName: 'Equilibrio Biacromial',
        passed: true,
        scoreDelta: +6,
        reason:
          'El escote barco amplía visualmente los hombros, equilibrando las caderas.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    return {
      ruleId: 'rule-shld-4',
      ruleName: 'Escote Neutro',
      passed: true,
      scoreDelta: +2,
      reason: 'Escote neutro armónico con la estructura clavicular.',
      pillar: 'silueta',
      potentialPointsGain: 0,
    };
  }

  /**
   * Regla 4: Acomodación de Curvatura (Definición de Cintura vs Efecto Carpa)
   */
  static evaluateCurvatureAccommodation(
    silhouette: AuraSilhouetteProfile,
    top?: GarmentAttributes
  ): RuleEvaluation {
    if (!top) {
      return {
        ruleId: 'rule-curv-0',
        ruleName: 'Curvatura Neutra',
        passed: true,
        scoreDelta: 0,
        reason: 'Prenda sin volumen evaluable.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    if (silhouette.curvature > 70 && top.fit === 'oversized' && top.structure === 'soft') {
      return {
        ruleId: 'rule-curv-1',
        ruleName: 'Efecto Carpa en Curvatura',
        passed: false,
        scoreDelta: -6,
        reason:
          'Prendas oversized sin estructura ocultan la cintura en siluetas curvas, ensanchando la figura.',
        pillar: 'silueta',
        remedy: 'Añadir cinturón o usar prendas ajustadas en el talle (+6 pts)',
        potentialPointsGain: 6,
      };
    }

    if (silhouette.curvature > 70 && (top.fit === 'fitted' || top.fit === 'tailored')) {
      return {
        ruleId: 'rule-curv-2',
        ruleName: 'Definición de Talle Áureo',
        passed: true,
        scoreDelta: +6,
        reason: 'Corte entallado que destaca la curvatura áurea natural de la figura.',
        pillar: 'silueta',
        potentialPointsGain: 0,
      };
    }

    return {
      ruleId: 'rule-curv-3',
      ruleName: 'Estructura Armónica',
      passed: true,
      scoreDelta: +2,
      reason: 'El ajuste respeta la caída natural del tejido sobre la silueta.',
      pillar: 'silueta',
      potentialPointsGain: 0,
    };
  }

  /**
   * Regla 5: Coherencia de Contraste Personal (Itten - Contraste de Valor)
   */
  static evaluateContrastCoherence(
    userContrast: ContrastLevel,
    top?: GarmentAttributes,
    bottom?: GarmentAttributes
  ): RuleEvaluation {
    if (!top || !bottom) {
      return {
        ruleId: 'rule-cntr-0',
        ruleName: 'Contraste Neutro',
        passed: true,
        scoreDelta: 0,
        reason: 'Conjunto incompleto para medir contraste.',
        pillar: 'estetica',
        potentialPointsGain: 0,
      };
    }

    if (userContrast === 'Alto' && top.contrastLevel === 'bajo' && bottom.contrastLevel === 'bajo') {
      return {
        ruleId: 'rule-cntr-1',
        ruleName: 'Apagado de Contraste Facial',
        passed: false,
        scoreDelta: -7,
        reason:
          'Un look monótono de bajo contraste apaga la luminosidad natural de tus facciones de alto contraste.',
        pillar: 'estetica',
        remedy: 'Aplicar Color Blocking (combinar prenda clara con oscura) (+7 pts)',
        potentialPointsGain: 7,
      };
    }

    if (userContrast === 'Alto' && (top.contrastLevel === 'alto' || bottom.contrastLevel === 'alto')) {
      return {
        ruleId: 'rule-cntr-2',
        ruleName: 'Color Blocking de Impacto',
        passed: true,
        scoreDelta: +7,
        reason: 'Contraste dinámico alineado con el diferencial de luminosidad facial.',
        pillar: 'estetica',
        potentialPointsGain: 0,
      };
    }

    if (userContrast === 'Bajo' && top.contrastLevel === 'alto') {
      return {
        ruleId: 'rule-cntr-3',
        ruleName: 'Saturación de Contraste',
        passed: false,
        scoreDelta: -5,
        reason:
          'El contraste extremo domina visualmente sobre la sutileza de tus facciones suaves.',
        pillar: 'estetica',
        remedy: 'Utilizar armonías monocromáticas o tonos fundidos (+5 pts)',
        potentialPointsGain: 5,
      };
    }

    return {
      ruleId: 'rule-cntr-4',
      ruleName: 'Equilibrio de Contraste',
      passed: true,
      scoreDelta: +4,
      reason: 'Contraste visual en consonancia con la escala de luminosidad personal.',
      pillar: 'estetica',
      potentialPointsGain: 0,
    };
  }

  /**
   * Regla 6: Enmarque de Rasgos y Geometría Mandibular
   */
  static evaluateFacialFraming(
    faceShape: FaceShape,
    top?: GarmentAttributes
  ): RuleEvaluation {
    if (!top || !top.neckline) {
      return {
        ruleId: 'rule-face-0',
        ruleName: 'Enmarque Facial',
        passed: true,
        scoreDelta: 0,
        reason: 'Sin escote evaluable para enmarque facial.',
        pillar: 'rasgos',
        potentialPointsGain: 0,
      };
    }

    if (faceShape === 'Redondo' && top.neckline === 'crew') {
      return {
        ruleId: 'rule-face-1',
        ruleName: 'Reiteración Circular Mandibular',
        passed: false,
        scoreDelta: -5,
        reason: 'El cuello redondo acentúa la circularidad del contorno mandibular.',
        pillar: 'rasgos',
        remedy: 'Optar por escote en V o solapas angulosas para alargar el rostro (+5 pts)',
        potentialPointsGain: 5,
      };
    }

    if (faceShape === 'Cuadrado' && top.neckline === 'square') {
      return {
        ruleId: 'rule-face-2',
        ruleName: 'Rigidez Geométrica',
        passed: false,
        scoreDelta: -5,
        reason: 'El escote cuadrado endurece las líneas del ángulo goniaco mandibular.',
        pillar: 'rasgos',
        remedy: 'Usar escote redondo, corazón o drapeado fluido (+5 pts)',
        potentialPointsGain: 5,
      };
    }

    if (
      (faceShape === 'Redondo' && top.neckline === 'v_neck') ||
      (faceShape === 'Cuadrado' && top.neckline === 'sweetheart') ||
      (faceShape === 'Ovalado')
    ) {
      return {
        ruleId: 'rule-face-3',
        ruleName: 'Enmarque Armónico',
        passed: true,
        scoreDelta: +5,
        reason: 'El escote compensa y resalta las proporciones áureas del tercio inferior del rostro.',
        pillar: 'rasgos',
        potentialPointsGain: 0,
      };
    }

    return {
      ruleId: 'rule-face-4',
      ruleName: 'Enmarque Neutro',
      passed: true,
      scoreDelta: +2,
      reason: 'Escote neutro compatible con el marco facial.',
      pillar: 'rasgos',
      potentialPointsGain: 0,
    };
  }

  /**
   * Evaluación Completa del Atuendo / Configuración de Estilo
   */
  static evaluateCompleteOutfit(
    silhouette: AuraSilhouetteProfile,
    undertone: Undertone,
    contrast: ContrastLevel,
    faceShape: FaceShape,
    top?: GarmentAttributes,
    bottom?: GarmentAttributes
  ): OutfitEvaluationResult {
    const evaluations: RuleEvaluation[] = [
      this.evaluateVerticality(silhouette, bottom),
      this.evaluateColorTemperature(undertone, top),
      this.evaluateShoulderBalance(silhouette, top),
      this.evaluateCurvatureAccommodation(silhouette, top),
      this.evaluateContrastCoherence(contrast, top, bottom),
      this.evaluateFacialFraming(faceShape, top),
    ];

    let totalPenalties = 0;
    let totalBonuses = 0;
    let passedCount = 0;
    let penaltiesCount = 0;
    let potentialGainSum = 0;

    evaluations.forEach((evalRes) => {
      if (evalRes.passed) {
        passedCount++;
        totalBonuses += evalRes.scoreDelta;
      } else {
        penaltiesCount++;
        totalPenalties += Math.abs(evalRes.scoreDelta);
        potentialGainSum += evalRes.potentialPointsGain;
      }
    });

    // Puntuación base determinista (100 - penalizaciones + bonificaciones equilibradas)
    const rawScore = 100 - totalPenalties + Math.round(totalBonuses * 0.4);
    const totalScore = Math.max(30, Math.min(100, rawScore));
    const projectedScoreIfFixed = Math.min(98, totalScore + potentialGainSum);

    // Desglose ponderado en los 4 pilares:
    // 1. Armonía Cromática (35%)
    // 2. Balance de Silueta (30%)
    // 3. Coherencia Estética (20%)
    // 4. Enmarque de Rasgos (15%)
    const colorEval = evaluations.find((e) => e.pillar === 'color');
    const silhouEval = evaluations.filter((e) => e.pillar === 'silueta');
    const estetEval = evaluations.find((e) => e.pillar === 'estetica');
    const faceEval = evaluations.find((e) => e.pillar === 'rasgos');

    const colorHarmonization = colorEval?.passed ? 94 : 68;
    const silhouetteBalance =
      silhouEval.filter((e) => e.passed).length === silhouEval.length
        ? 92
        : Math.round((silhouEval.filter((e) => e.passed).length / silhouEval.length) * 85);
    const aestheticCoherence = estetEval?.passed ? 90 : 70;
    const facialFraming = faceEval?.passed ? 92 : 72;

    return {
      totalScore,
      evaluations,
      passedCount,
      penaltiesCount,
      totalPenalties,
      totalBonuses,
      projectedScoreIfFixed,
      pillarBreakdown: {
        colorHarmonization,
        silhouetteBalance,
        aestheticCoherence,
        facialFraming,
      },
    };
  }
}
