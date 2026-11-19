import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WardrobeItem,
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  type WardrobeCategory,
  type WardrobeSeason,
  type WardrobeSubcategory,
} from './entities/wardrobe-item.entity';
import { BellaiDiagnostic } from '../bellai/entities/bellai-diagnostic.entity';
import { WardrobeEnhancementService } from './wardrobe-enhancement.service';
import { hexDistance2000, isHex } from '../../common/color/color.util';
import { Preferences } from '../profile/entities/preferences.entity';
import { EvaluateStoreGarmentDto } from './dto/evaluate-store-garment.dto';

export type CompatibilityLevel = 'alto' | 'medio' | 'bajo';

export interface MatchingWardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  categoryLabel: string;
  color: string | null;
  colorHex: string | null;
  photoUrl: string | null;
  matchReason: string;
}

export interface StoreGarmentEvaluationResult {
  compatibilityLevel: CompatibilityLevel;
  compatibilityScore: number;
  verdictTitle: string;
  summary: string;
  colorAnalysis: {
    seasonalHarmony: 'favorable' | 'neutro' | 'desfavorable';
    userSeason: string;
    userUndertone: string;
    colorEvaluated: string;
    description: string;
  };
  wardrobeAnalysis: {
    matchingCount: number;
    description: string;
  };
  matchingWardrobeItems: MatchingWardrobeItem[];
  recommendationTips: string[];
  /** Lo que la IA detectó en la foto de la tienda (null si no hubo foto o el servicio no respondió) */
  detectedFromPhoto: {
    subcategory: string;
    color: string;
    colorHex: string;
    pattern: string | null;
    confidence: number | null;
  } | null;
  /** Prendas del armario que ya son casi iguales: mismo tipo, mismo color (CIEDE2000 < 10) y estampado */
  similarWardrobeItems: (MatchingWardrobeItem & { colorDifference: number | null; likelyDuplicate: boolean })[];
}

/** Por debajo de esta diferencia CIEDE2000, dos prendas se perciben del mismo color. */
const SAME_COLOR_DE = 10;
/** Similitud coseno del vector visual a partir de la cual es la misma prenda (fotos casi iguales). */
const DUPLICATE_COSINE = 0.9;

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Tonos neutros universales que combinan con prácticamente cualquier color. */
const UNIVERSAL_NEUTRALS = [
  'negro',
  'blanco',
  'gris',
  'beige',
  'crema',
  'arena',
  'hueso',
  'marfil',
  'camel',
  'denim',
  'azul marino',
  'marino',
  'marron',
  'marrón',
  'cafe',
  'café',
  'taupe',
];

/**
 * Paletas estacionales y sus familias cromáticas favorables y a evitar.
 */
interface SeasonPaletteRules {
  favorableColors: string[];
  avoidColors: string[];
  description: string;
}

const SEASON_RULES: Record<string, SeasonPaletteRules> = {
  primavera: {
    favorableColors: [
      'coral',
      'melocoton',
      'melocotón',
      'dorado',
      'salmon',
      'salmón',
      'turquesa',
      'verde manzana',
      'marfil',
      'camel',
      'amarillo',
      'verde claro',
      'beige',
      'naranja',
    ],
    avoidColors: [
      'negro puro',
      'blanco frio',
      'blanco frío',
      'gris oscuro',
      'burdeos oscuro',
      'gris plomo',
    ],
    description:
      'Tu estación Primavera resalta con tonos cálidos, luminosos y brillantes que aportan vitalidad a tu rostro.',
  },
  verano: {
    favorableColors: [
      'rosa pastel',
      'lavanda',
      'azul cielo',
      'gris perla',
      'frambuesa',
      'ciruela',
      'azul marino suave',
      'menta',
      'lila',
      'rosa empolvado',
      'azul petroleo',
    ],
    avoidColors: [
      'naranja',
      'mostaza',
      'dorado intenso',
      'marron oxido',
      'marrón óxido',
      'amarillo calido',
    ],
    description:
      'Tu estación Verano armoniza con tonos fríos, suaves y empolvados que aportan frescura y serenidad a tus facciones.',
  },
  otono: {
    favorableColors: [
      'terracota',
      'mostaza',
      'verde oliva',
      'cafe',
      'café',
      'oxido',
      'óxido',
      'cobre',
      'teja',
      'caqui',
      'beige arena',
      'verde musgo',
      'marron',
      'marrón',
    ],
    avoidColors: [
      'fucsia brillante',
      'azul electrico',
      'azul eléctrico',
      'blanco puro',
      'gris frio',
      'gris frío',
      'rosa chicle',
    ],
    description:
      'Tu estación Otoño se potencia con tonos cálidos, terrosos y profundos que enriquecen los matices de tu piel y cabello.',
  },
  invierno: {
    favorableColors: [
      'negro',
      'blanco puro',
      'azul marino',
      'rojo carmesi',
      'rojo carmesí',
      'fucsia',
      'verde esmeralda',
      'azul rey',
      'azul cobalto',
      'plateado',
      'magenta',
      'rojo',
    ],
    avoidColors: [
      'naranja quemado',
      'mostaza',
      'marron dorado',
      'marrón dorado',
      'beige calido',
      'caqui apagado',
    ],
    description:
      'Tu estación Invierno destaca con tonos fríos, contrastados y de alta saturación que realzan tu presencia.',
  },
};

@Injectable()
export class StoreGarmentEvaluatorService {
  private readonly logger = new Logger(StoreGarmentEvaluatorService.name);

  constructor(
    @InjectRepository(WardrobeItem)
    private readonly wardrobeRepository: Repository<WardrobeItem>,
    @InjectRepository(BellaiDiagnostic)
    private readonly diagnosticRepository: Repository<BellaiDiagnostic>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    private readonly enhancement: WardrobeEnhancementService,
  ) {}

  /**
   * HU-24: Evalúa si una prenda que la usuaria está viendo en una tienda es compatible
   * con su perfil (colorimetría/estación personal) y con las prendas reales de su armario.
   */
  async evaluate(
    userId: string,
    dto: EvaluateStoreGarmentDto,
    photoFile?: Express.Multer.File,
  ): Promise<StoreGarmentEvaluationResult> {
    // Foto de la tienda: la IA detecta tipo, color y estampado. Lo que escribe la usuaria manda.
    const ai = photoFile?.buffer ? await this.enhancement.analyzePhoto(photoFile).catch(() => null) : null;
    const detectedFromPhoto = ai
      ? { subcategory: ai.subcategory, color: ai.color, colorHex: ai.color_hex, pattern: ai.pattern ?? null, confidence: ai.confidence ?? null }
      : null;
    dto = {
      ...dto,
      subcategory: dto.subcategory ?? (ai?.subcategory as WardrobeSubcategory | undefined),
      color: dto.color ?? ai?.color,
      colorHex: dto.colorHex ?? ai?.color_hex,
    };

    const [latestDiagnostic, preferences, confirmedWardrobeItems] =
      await Promise.all([
        this.diagnosticRepository.findOne({
          where: { userId },
          order: { createdAt: 'DESC' },
        }),
        this.preferencesRepository.findOne({ where: { userId } }),
        this.wardrobeRepository.find({
          where: { userId, status: 'confirmed' },
          order: { wearCount: 'DESC', createdAt: 'DESC' },
        }),
      ]);

    const evaluatedColor = (dto.color || 'Neutro').trim();
    const evaluatedCategory = dto.category;

    // 1. Evaluación de colorimetría / estación personal
    const colorAnalysis = this.analyzeColorimetry(
      evaluatedColor,
      latestDiagnostic,
      preferences,
    );

    // 2. Búsqueda y evaluación de prendas del armario que combinan
    const matchingWardrobeItems = this.findMatchingWardrobeItems(
      evaluatedCategory,
      dto.subcategory,
      evaluatedColor,
      dto.season,
      dto.occasion,
      confirmedWardrobeItems,
    );

    // 3. Puntuación y nivel de compatibilidad
    let score = 50; // Base neutra

    if (colorAnalysis.seasonalHarmony === 'favorable') {
      score += 30;
    } else if (colorAnalysis.seasonalHarmony === 'neutro') {
      score += 15;
    } else {
      score -= 25;
    }

    const matchCount = matchingWardrobeItems.length;
    if (matchCount >= 3) {
      score += 25;
    } else if (matchCount === 2) {
      score += 15;
    } else if (matchCount === 1) {
      score += 5;
    } else {
      score -= 20; // Advertencia clave de HU-24: no tiene con qué usarla
    }

    // 2b. ¿Ya tiene algo casi igual? Comprar un duplicado es justo lo que HU-24 quiere evitar
    const similarWardrobeItems = this.findSimilarItems(dto, ai?.pattern ?? null, ai?.feature_vector, confirmedWardrobeItems);
    if (similarWardrobeItems.length) score -= similarWardrobeItems.some((s) => s.likelyDuplicate) ? 30 : 15;

    // Normalizar score entre 0 y 100
    score = Math.max(10, Math.min(98, score));

    let compatibilityLevel: CompatibilityLevel = 'medio';
    if (score >= 75 && matchCount >= 2) {
      compatibilityLevel = 'alto';
    } else if (score < 45 || matchCount === 0 || colorAnalysis.seasonalHarmony === 'desfavorable') {
      compatibilityLevel = 'bajo';
    }

    // 4. Explicaciones en lenguaje natural claro y sobrio (sin slop)
    const { verdictTitle, summary, wardrobeDescription, recommendationTips } =
      this.generateExplanations(
        compatibilityLevel,
        score,
        evaluatedCategory,
        evaluatedColor,
        colorAnalysis,
        matchCount,
        matchingWardrobeItems,
      );

    return {
      compatibilityLevel,
      compatibilityScore: score,
      verdictTitle,
      summary,
      colorAnalysis: {
        ...colorAnalysis,
        colorEvaluated: evaluatedColor,
      },
      wardrobeAnalysis: {
        matchingCount: matchCount,
        description: wardrobeDescription,
      },
      matchingWardrobeItems,
      recommendationTips: similarWardrobeItems.length
        ? [this.similarTip(similarWardrobeItems), ...recommendationTips]
        : recommendationTips,
      detectedFromPhoto,
      similarWardrobeItems,
    };
  }

  private similarTip(similar: StoreGarmentEvaluationResult['similarWardrobeItems']): string {
    const dup = similar.find((s) => s.likelyDuplicate);
    if (dup) return `Parece la misma prenda que ya tienes: «${dup.name}». Revisa tu armario antes de comprarla.`;
    const names = similar.slice(0, 2).map((s) => `«${s.name}»`).join(' y ');
    return `Ya tienes algo muy parecido (${names}): mismo tipo y mismo color. Piensa si esta aporta algo nuevo (corte, tejido u ocasión).`;
  }

  /** Prendas del mismo tipo y color perceptualmente igual; con vector visual, detecta duplicados. */
  private findSimilarItems(
    dto: EvaluateStoreGarmentDto,
    pattern: string | null,
    vector: number[] | undefined,
    items: WardrobeItem[],
  ): StoreGarmentEvaluationResult['similarWardrobeItems'] {
    const hex = dto.colorHex && isHex(dto.colorHex) ? dto.colorHex : null;
    const name = this.normalizeText(dto.color || '');
    const out: StoreGarmentEvaluationResult['similarWardrobeItems'] = [];
    for (const item of items) {
      const sameType = dto.subcategory ? item.subcategory === dto.subcategory : item.category === dto.category;
      if (!sameType) continue;
      let de: number | null = null;
      let sameColor: boolean;
      if (hex && item.colorHex && isHex(item.colorHex)) {
        de = hexDistance2000(hex, item.colorHex);
        sameColor = de < SAME_COLOR_DE;
      } else {
        sameColor = Boolean(name) && this.normalizeText(item.color || '') === name;
      }
      if (!sameColor) continue;
      const itemPattern = item.aiMetadata?.pattern ?? null;
      if (pattern && itemPattern && pattern !== itemPattern) continue;
      const emb = item.aiMetadata?.embedding;
      const likelyDuplicate = Boolean(vector && Array.isArray(emb) && cosine(vector, emb) >= DUPLICATE_COSINE);
      const subLabel = SUBCATEGORY_LABELS[item.subcategory] || item.subcategory;
      out.push({
        id: item.id,
        name: item.name || `${subLabel} ${item.color || ''}`.trim(),
        category: item.category,
        subcategory: item.subcategory,
        categoryLabel: `${CATEGORY_LABELS[item.category] || item.category} • ${subLabel}`,
        color: item.color,
        colorHex: item.colorHex,
        photoUrl: item.enhancedImageUrl || item.originalImageUrl,
        matchReason: likelyDuplicate ? 'Parece la misma prenda' : 'Mismo tipo y mismo color',
        colorDifference: de === null ? null : Math.round(de * 10) / 10,
        likelyDuplicate,
      });
    }
    return out.sort((a, b) => Number(b.likelyDuplicate) - Number(a.likelyDuplicate) || (a.colorDifference ?? 99) - (b.colorDifference ?? 99)).slice(0, 3);
  }

  private analyzeColorimetry(
    garmentColor: string,
    diagnostic: BellaiDiagnostic | null,
    preferences: Preferences | null,
  ): {
    seasonalHarmony: 'favorable' | 'neutro' | 'desfavorable';
    userSeason: string;
    userUndertone: string;
    description: string;
  } {
    const normalizedColor = this.normalizeText(garmentColor);
    const isNeutral = UNIVERSAL_NEUTRALS.some((neutral) =>
      normalizedColor.includes(neutral),
    );

    if (!diagnostic) {
      const avoidedColors = (preferences?.stylePreferences?.avoidedColors || []).map(
        (c) => this.normalizeText(c),
      );
      const isAvoided = avoidedColors.some((c) => normalizedColor.includes(c));

      if (isAvoided) {
        return {
          seasonalHarmony: 'desfavorable',
          userSeason: 'No registrada',
          userUndertone: 'No registrado',
          description: `El color "${garmentColor}" coincide con los tonos que prefieres evitar en tus ajustes personales.`,
        };
      }

      if (isNeutral) {
        return {
          seasonalHarmony: 'favorable',
          userSeason: 'No registrada',
          userUndertone: 'No registrado',
          description: `El tono "${garmentColor}" es un neutro versátil fácil de coordinar. Completa tu análisis facial para obtener precisión cromática.`,
        };
      }

      return {
        seasonalHarmony: 'neutro',
        userSeason: 'No registrada',
        userUndertone: 'No registrado',
        description: `Evaluado como tono estándar. Te recomendamos completar tu análisis facial en "Mi análisis" para conocer tu estación cromática exacta.`,
      };
    }

    const seasonKey = this.extractSeasonKey(diagnostic.seasonalPalette);
    const rule = SEASON_RULES[seasonKey];
    const userSeasonLabel = diagnostic.seasonalPalette || 'Estación personal';
    const userUndertoneLabel = diagnostic.undertone || 'Natural';

    if (!rule) {
      return {
        seasonalHarmony: isNeutral ? 'favorable' : 'neutro',
        userSeason: userSeasonLabel,
        userUndertone: userUndertoneLabel,
        description: `Tono coordinado con tu perfil general (${userSeasonLabel}, subtono ${userUndertoneLabel}).`,
      };
    }

    // Verificar si es un color favorable de la estación
    const isFavorable = rule.favorableColors.some((fav) =>
      normalizedColor.includes(this.normalizeText(fav)),
    );

    // Verificar si es un color a evitar
    const isAvoid = rule.avoidColors.some((avoid) =>
      normalizedColor.includes(this.normalizeText(avoid)),
    );

    if (isAvoid) {
      return {
        seasonalHarmony: 'desfavorable',
        userSeason: userSeasonLabel,
        userUndertone: userUndertoneLabel,
        description: `El tono "${garmentColor}" puede restar luminosidad a tu subtono ${userUndertoneLabel}. Tu estación (${userSeasonLabel}) luce mejor con colores de su paleta propia.`,
      };
    }

    if (isFavorable) {
      return {
        seasonalHarmony: 'favorable',
        userSeason: userSeasonLabel,
        userUndertone: userUndertoneLabel,
        description: `El tono "${garmentColor}" pertenece a la paleta ideal de tu estación (${userSeasonLabel}) y realza tu subtono ${userUndertoneLabel}.`,
      };
    }

    if (isNeutral) {
      return {
        seasonalHarmony: 'favorable',
        userSeason: userSeasonLabel,
        userUndertone: userUndertoneLabel,
        description: `El tono "${garmentColor}" funciona como base neutra equilibrada para tu estación (${userSeasonLabel}).`,
      };
    }

    return {
      seasonalHarmony: 'neutro',
      userSeason: userSeasonLabel,
      userUndertone: userUndertoneLabel,
      description: `El color "${garmentColor}" ofrece armonía moderada con tu subtono ${userUndertoneLabel}. ${rule.description}`,
    };
  }

  private findMatchingWardrobeItems(
    targetCategory: WardrobeCategory,
    targetSubcategory: WardrobeSubcategory | undefined,
    targetColor: string,
    targetSeason: WardrobeSeason | undefined,
    _targetOccasion: string | undefined,
    items: WardrobeItem[],
  ): MatchingWardrobeItem[] {
    const compatibleCategories = this.getComplementaryCategories(
      targetCategory,
      targetSubcategory,
    );
    const candidateItems = items.filter((item) =>
      compatibleCategories.includes(item.category),
    );

    const matches: MatchingWardrobeItem[] = [];
    const normalizedTargetColor = this.normalizeText(targetColor);
    const isTargetNeutral = UNIVERSAL_NEUTRALS.some((n) =>
      normalizedTargetColor.includes(n),
    );

    for (const item of candidateItems) {
      if (matches.length >= 4) break;

      const itemColor = item.color || '';
      const normalizedItemColor = this.normalizeText(itemColor);
      const isItemNeutral = UNIVERSAL_NEUTRALS.some((n) =>
        normalizedItemColor.includes(n),
      );

      let reason = '';
      let isCompatible = false;

      if (isTargetNeutral && isItemNeutral) {
        isCompatible = true;
        reason = `Base neutra atemporal: ambas prendas combinan con sobriedad y equilibrio.`;
      } else if (isTargetNeutral || isItemNeutral) {
        isCompatible = true;
        reason = `Contraste limpio: la base neutra permite destacar el tono de la otra prenda sin saturar.`;
      } else if (this.areColorsHarmonious(normalizedTargetColor, normalizedItemColor)) {
        isCompatible = true;
        reason = `Armonía cromática: pertenecen a familias complementarias que coordinan naturalmente.`;
      } else if (
        targetSeason &&
        item.season &&
        (item.season === targetSeason || item.season === 'todo_el_ano')
      ) {
        isCompatible = true;
        reason = `Prenda apta para la misma temporada (${targetSeason}).`;
      }

      if (isCompatible) {
        matches.push({
          id: item.id,
          name: item.name || `${SUBCATEGORY_LABELS[item.subcategory] || item.subcategory}`,
          category: item.category,
          subcategory: item.subcategory,
          categoryLabel: CATEGORY_LABELS[item.category] || item.category,
          color: item.color || null,
          colorHex: item.colorHex || null,
          photoUrl: item.enhancedImageUrl || item.originalImageUrl || null,
          matchReason: reason,
        });
      }
    }

    return matches;
  }

  private getComplementaryCategories(
    category: WardrobeCategory,
    subcategory?: WardrobeSubcategory,
  ): WardrobeCategory[] {
    if (subcategory === 'vestidos') {
      return ['abrigo', 'calzado', 'accesorio'];
    }
    switch (category) {
      case 'superior':
        return ['inferior', 'abrigo', 'calzado'];
      case 'inferior':
        return ['superior', 'abrigo', 'calzado'];
      case 'abrigo':
        return ['superior', 'inferior'];
      case 'calzado':
        return ['superior', 'inferior'];
      case 'accesorio':
        return ['superior', 'inferior', 'abrigo'];
      default:
        return ['superior', 'inferior'];
    }
  }

  private areColorsHarmonious(colorA: string, colorB: string): boolean {
    if (!colorA || !colorB) return false;

    // Tonos cálidos terrosos que coordinan entre sí
    const warmEarth = ['terracota', 'mostaza', 'oliva', 'cafe', 'café', 'marron', 'marrón', 'oxido', 'óxido', 'beige', 'camel'];
    const isAWarm = warmEarth.some((c) => colorA.includes(c));
    const isBWarm = warmEarth.some((c) => colorB.includes(c));
    if (isAWarm && isBWarm) return true;

    // Tonos fríos / azules
    const coolBlues = ['azul', 'marino', 'celeste', 'gris', 'denim', 'blanco'];
    const isACool = coolBlues.some((c) => colorA.includes(c));
    const isBCool = coolBlues.some((c) => colorB.includes(c));
    if (isACool && isBCool) return true;

    // Parejas complementarias clásicas
    if (colorA.includes('mostaza') && (colorB.includes('azul') || colorB.includes('denim'))) return true;
    if (colorB.includes('mostaza') && (colorA.includes('azul') || colorA.includes('denim'))) return true;
    if (colorA.includes('oliva') && (colorB.includes('blanco') || colorB.includes('beige'))) return true;
    if (colorB.includes('oliva') && (colorA.includes('blanco') || colorA.includes('beige'))) return true;

    return false;
  }

  private generateExplanations(
    level: CompatibilityLevel,
    score: number,
    category: WardrobeCategory,
    color: string,
    colorAnalysis: {
      seasonalHarmony: 'favorable' | 'neutro' | 'desfavorable';
      userSeason: string;
      userUndertone: string;
      description: string;
    },
    matchCount: number,
    matchingItems: MatchingWardrobeItem[],
  ) {
    const categoryName = CATEGORY_LABELS[category] || category;
    const tips: string[] = [];

    let verdictTitle = '';
    let summary = '';
    let wardrobeDescription = '';

    if (level === 'alto') {
      verdictTitle = 'Compatibilidad Alta · Compra inteligente recomendada';
      summary = `Esta prenda ${categoryName.toLowerCase()} en tono ${color.toLowerCase()} encaja tanto con tu colorimetría personal como con tu armario actual.`;
      wardrobeDescription = `Tienes ${matchCount} prenda(s) compatible(s) en tu armario con las que podrás armar combinaciones listas para usar de inmediato.`;

      tips.push('Aprovecha la versatilidad de la prenda combinándola con las opciones sugeridas de tu armario.');
      tips.push('Antes de comprar, comprueba la composición del tejido y el calce según tu talla habitual.');
    } else if (level === 'medio') {
      verdictTitle = 'Compatibilidad Media · Compra condicional o versátil';

      if (matchCount <= 1) {
        summary = `El color es adecuado, pero cuentas con pocas prendas en tu armario para combinarla directamente (${matchCount} encontrada).`;
        wardrobeDescription = `Solo identificamos ${matchCount} prenda de tu armario compatible. Podrías requerir piezas adicionales para sacarle suficiente partido.`;
        tips.push('Evalúa si tienes previsto adquirir las prendas complementarias o si prefieres una opción que combine con más ropa tuya.');
      } else {
        summary = `La prenda combina bien con tu armario, aunque el tono ${color.toLowerCase()} ofrece una armonía moderada con tu perfil.`;
        wardrobeDescription = `Combina con ${matchCount} prendas de tu armario, lo que garantiza uso práctico.`;
        tips.push('Puedes equilibrar el color usando accesorios o prendas cercanas al rostro en tu paleta favorable.');
      }
    } else {
      verdictTitle = 'Compatibilidad Baja · Riesgo de compra poco utilizada';

      if (colorAnalysis.seasonalHarmony === 'desfavorable' && matchCount === 0) {
        summary = `El tono ${color.toLowerCase()} no favorece tu estación (${colorAnalysis.userSeason}) y además no tienes prendas en tu armario que combinen directamente con ella.`;
        wardrobeDescription = 'No se encontraron prendas en tu armario con las que puedas armar un conjunto armonioso sin compras adicionales.';
        tips.push('Te recomendamos evitar esta compra para prevenir prendas sin usar en tu armario.');
        tips.push('Busca una prenda similar en tonos que pertenezcan a tu paleta o en una base neutra como azul marino, gris o beige.');
      } else if (matchCount === 0) {
        summary = `Aunque el tono es aceptable, tu armario no tiene actualmente prendas de categoría complementaria para armar combinaciones con esta pieza.`;
        wardrobeDescription = 'Tu armario no cuenta con piezas compatibles registradas para esta prenda.';
        tips.push('Comprar esta prenda implicaría adquirir prendas adicionales para poder vestirla.');
        tips.push('Considera registrar más prendas en tu armario o priorizar compras que completen conjuntos que ya tienes.');
      } else {
        summary = `El tono ${color.toLowerCase()} contrasta de forma desfavorable con tu subtono ${colorAnalysis.userUndertone}.`;
        wardrobeDescription = `Aunque se encontraron ${matchCount} prenda(s) física(s) con las que unirla, el impacto cromático cerca del rostro no resulta favorable.`;
        tips.push('Si decides comprarla, aléjala del rostro combinándola como prenda inferior o con una bufanda/chaqueta en tu paleta.');
      }
    }

    if (matchingItems.length > 0) {
      const garmentNames = matchingItems.map((m) => m.name).slice(0, 3).join(', ');
      tips.push(`Combina de forma directa con: ${garmentNames}.`);
    }

    return {
      verdictTitle,
      summary,
      wardrobeDescription,
      recommendationTips: tips,
    };
  }

  private extractSeasonKey(paletteName: string | undefined): string {
    if (!paletteName) return 'otono';
    const clean = this.normalizeText(paletteName);
    if (clean.includes('primavera') || clean.includes('spring')) return 'primavera';
    if (clean.includes('verano') || clean.includes('summer')) return 'verano';
    if (clean.includes('otono') || clean.includes('otoño') || clean.includes('autumn')) return 'otono';
    if (clean.includes('invierno') || clean.includes('winter')) return 'invierno';
    return 'otono';
  }

  private normalizeText(text: string): string {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
