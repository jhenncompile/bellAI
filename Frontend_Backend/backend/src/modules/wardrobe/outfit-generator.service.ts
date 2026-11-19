import { Injectable } from '@nestjs/common';
import {
  WardrobeItem,
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  type WardrobeSeason,
  type WardrobeSubcategory,
} from './entities/wardrobe-item.entity';
import {
  type OutfitOccasion,
  type OutfitWeatherCondition,
  OUTFIT_OCCASIONS,
  OUTFIT_WEATHER_CONDITIONS,
} from './dto/generate-outfits.dto';
import {
  type Garment as EngineGarment,
  type OutfitContext,
  garmentColorScore,
  scoreOutfit,
} from '../outfits/outfit.engine';
import { outfitAffinity } from '../outfits/feedback-profile';

/**
 * HU-23: cuánto mueven las valoraciones guardadas en la cuenta el orden de las combinaciones
 * (en la misma escala que ocasión y clima). La misma combinación que no le agradó baja aún más.
 */
const FEEDBACK_PRIORITY = 20;
const DISLIKED_COMBINATION_PENALTY = 30;
/** Afinidad desde la que una propuesta se marca como «priorizada por tus valoraciones». */
const PRIORITIZED_AFFINITY = 0.15;

/**
 * HU-19 / HU-20 / HU-23: Generador de combinaciones de vestimenta con las prendas del armario,
 * adaptadas por ocasión y clima del día (HU-20) y ajustadas según las valoraciones (HU-23).
 *
 * Reglas (criterios de aceptación):
 * 1. Sólo usa prendas registradas y confirmadas en el armario de la usuaria (el llamador
 *    entrega exclusivamente esas prendas; aquí no se inventa ninguna).
 * 2. Cada combinación lleva una prenda superior + una inferior, o una prenda de cuerpo entero.
 *    Calzado y abrigo se añaden sólo si existen en el armario.
 * 3. Si no hay prendas suficientes, la respuesta lo indica (`isSufficient: false`) y dice qué falta.
 * 4. HU-20: La usuaria puede elegir la ocasión (trabajo, universidad, evento, entre otras).
 * 5. HU-20: La aplicación considera el clima del día de la ubicación de la usuaria.
 * 6. HU-20: Si la información climática no está disponible, se generan combinaciones solo por
 *    ocasión y se informa con `weatherNotice`.
 * 7. HU-23: Las prendas y combinaciones valoradas negativamente aparecen con menor frecuencia.
 * 8. HU-23: Las características valoradas positivamente se priorizan en nuevas propuestas.
 *
 * La lógica es determinista y explicable: no se calculan porcentajes ni métricas cromáticas
 * que no podamos respaldar. El orden prioriza valoraciones de la usuaria, adecuación a la ocasión,
 * clima del día, armonía de color legible y rotación de prendas.
 */

export type OutfitRole = 'superior' | 'inferior' | 'cuerpo_entero' | 'calzado' | 'abrigo';
export type OutfitType = 'dos_piezas' | 'cuerpo_entero';
export type OutfitHarmony = 'base_neutra' | 'misma_familia' | 'contraste' | 'pieza_unica' | 'sin_datos';

export interface OutfitGarment {
  id: string;
  name: string;
  category: string;
  subcategory: WardrobeSubcategory;
  categoryLabel: string;
  color: string | null;
  colorHex: string | null;
  season: WardrobeSeason | null;
  photoUrl: string | null;
  wearCount: number;
  lastWornAt: Date | null;
}

export interface OutfitPiece {
  role: OutfitRole;
  roleLabel: string;
  item: OutfitGarment;
}

export interface GeneratedOutfit {
  id: string;
  type: OutfitType;
  pieces: OutfitPiece[];
  season: WardrobeSeason | null;
  seasonLabel: string;
  harmony: OutfitHarmony;
  harmonyLabel: string;
  reason: string;
  isPrioritized?: boolean;
  prioritizedReason?: string;
  occasion?: OutfitOccasion;
  occasionLabel?: string;
  /** Puntuación 0-100 del motor de outfits (paleta, armonía, coherencia, ocasión, clima, Style DNA) */
  score?: number;
  /** Factores bien resueltos, en frases cortas */
  highlights?: string[];
}

export interface OutfitsResponse {
  isSufficient: boolean;
  /** Presente cuando el armario no tiene prendas para armar ni una combinación. */
  insufficient: {
    title: string;
    message: string;
    missing: string[];
    ctaLabel: string;
  } | null;
  /** Presente cuando hay prendas suficientes pero el filtro no deja ninguna combinación. */
  noMatches: {
    title: string;
    message: string;
    ctaLabel: string;
  } | null;
  summary: {
    totalConfirmed: number;
    tops: number;
    bottoms: number;
    onePieces: number;
    shoes: number;
    outerwear: number;
  };
  outfits: GeneratedOutfit[];
  generatedAt: string;
  /** HU-20: Ocasión seleccionada o por defecto ('todas'). */
  occasion?: OutfitOccasion;
  occasionLabel?: string;
  /** HU-20: Condición climática aplicada si estaba disponible. */
  weatherCondition?: OutfitWeatherCondition | null;
  weatherLabel?: string | null;
  /** HU-20 Criterio 3: Mensaje informativo cuando la información climática no estuvo disponible. */
  weatherNotice?: string | null;
}

export interface GenerateOutfitsOptions {
  season?: WardrobeSeason;
  limit?: number;
  occasion?: OutfitOccasion;
  weatherCondition?: OutfitWeatherCondition;
  temperature?: number;
  likedGarmentIds?: string[];
  dislikedGarmentIds?: string[];
  likedColors?: string[];
  dislikedColors?: string[];
}

/** Prendas de cuerpo entero. */
const ONE_PIECE_SUBCATEGORIES: WardrobeSubcategory[] = ['vestidos'];
/** Prendas de categoría "abrigo" que también funcionan como prenda superior. */
const TOP_CAPABLE_LAYERS: WardrobeSubcategory[] = ['sueteres'];

export const SEASON_LABELS: Record<WardrobeSeason, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
  todo_el_ano: 'Todo el año',
};

export const OCCASION_LABELS: Record<OutfitOccasion, string> = {
  todas: 'Todas las ocasiones',
  trabajo: 'Trabajo',
  universidad: 'Universidad',
  evento: 'Evento',
  diario: 'Diario',
  deporte: 'Deporte',
};

export const WEATHER_CONDITION_LABELS: Record<OutfitWeatherCondition, string> = {
  frio: 'Clima frío',
  templado: 'Clima templado',
  calido: 'Clima cálido',
  lluvia: 'Día lluvioso',
};

const ROLE_LABELS: Record<OutfitRole, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  cuerpo_entero: 'Cuerpo entero',
  calzado: 'Calzado',
  abrigo: 'Abrigo',
};

const HARMONY_LABELS: Record<OutfitHarmony, string> = {
  base_neutra: 'Base neutra',
  misma_familia: 'Misma familia de color',
  contraste: 'Contraste de color',
  pieza_unica: 'Prenda de cuerpo entero',
  sin_datos: 'Por categoría y temporada',
};

/** Nombres de color que se tratan como neutros cuando no hay código hexadecimal. */
const NEUTRAL_COLOR_NAMES = [
  'negro', 'blanco', 'gris', 'beige', 'crema', 'arena', 'hueso', 'marfil',
  'camel', 'cafe', 'café', 'marron', 'marrón', 'taupe', 'marino', 'denim', 'nude',
];

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
/** Veces que una misma prenda principal puede repetirse entre las combinaciones devueltas. */
const MAX_USES_PER_GARMENT = 2;

interface Candidate {
  score?: number;
  highlights?: string[];
  type: OutfitType;
  core: WardrobeItem[];
  harmony: OutfitHarmony;
  season: WardrobeSeason | null;
  priority: number;
  wear: number;
  key: string;
  isPrioritized?: boolean;
  /** HU-23: por qué se priorizó, a partir de las valoraciones guardadas en la cuenta */
  prioritizedReason?: string;
}

@Injectable()
export class OutfitGeneratorService {
  /**
   * `ctx` es el contexto personal (paleta del diagnóstico, colores a evitar, Style DNA, valoraciones).
   * Con él, cada combinación se puntúa con el mismo motor que /outfits/generate; sin él, se usan
   * solo las reglas de ocasión, clima y color de este servicio.
   */
  generate(items: WardrobeItem[], options: GenerateOutfitsOptions = {}, ctx?: OutfitContext): OutfitsResponse {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const confirmed = items.filter((i) => i.status === 'confirmed');

    const onePieces = confirmed.filter((i) => ONE_PIECE_SUBCATEGORIES.includes(i.subcategory));
    const tops = confirmed.filter(
      (i) =>
        (i.category === 'superior' && !ONE_PIECE_SUBCATEGORIES.includes(i.subcategory)) ||
        TOP_CAPABLE_LAYERS.includes(i.subcategory),
    );
    const bottoms = confirmed.filter((i) => i.category === 'inferior');
    const shoes = confirmed.filter((i) => i.category === 'calzado');
    const outerwear = confirmed.filter(
      (i) => i.category === 'abrigo' && !TOP_CAPABLE_LAYERS.includes(i.subcategory),
    );

    const summary = {
      totalConfirmed: confirmed.length,
      tops: tops.length,
      bottoms: bottoms.length,
      onePieces: onePieces.length,
      shoes: shoes.length,
      outerwear: outerwear.length,
    };

    const hasTwoPiece = tops.length > 0 && bottoms.length > 0;
    if (!hasTwoPiece && onePieces.length === 0) {
      return {
        isSufficient: false,
        insufficient: this.buildInsufficient(tops.length, bottoms.length),
        noMatches: null,
        summary,
        outfits: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const fitsSeason = (item: WardrobeItem) =>
      !options.season || seasonsCompatible(item.season, options.season);

    // Conjuntos de valoraciones previas (HU-23)
    const dislikedGarmentsSet = new Set(
      (options.dislikedGarmentIds || []).map((id) => String(id).trim()),
    );
    const likedGarmentsSet = new Set(
      (options.likedGarmentIds || []).map((id) => String(id).trim()),
    );
    const dislikedColors = (options.dislikedColors || []).map((c) =>
      String(c).trim().toLowerCase(),
    );
    const likedColors = (options.likedColors || []).map((c) =>
      String(c).trim().toLowerCase(),
    );

    const computeFeedbackModifier = (coreItems: WardrobeItem[]) => {
      let mod = 0;
      let prioritized = false;

      // Penalización si incluye prendas valoradas negativamente
      const hasDisliked = coreItems.some((g) => dislikedGarmentsSet.has(g.id));
      if (hasDisliked) {
        mod -= 20; // Penalización severa para que aparezcan con mucha menor frecuencia
      }

      // Bonificación si incluye prendas valoradas positivamente
      const hasLiked = coreItems.some((g) => likedGarmentsSet.has(g.id));
      if (hasLiked) {
        mod += 15;
        prioritized = true;
      }

      // Ajuste por colores valorados
      for (const item of coreItems) {
        const hex = item.colorHex?.trim().toLowerCase();
        const name = item.color?.trim().toLowerCase();
        if (
          (hex && dislikedColors.includes(hex)) ||
          (name && dislikedColors.some((c) => name.includes(c)))
        ) {
          mod -= 8;
        }
        if (
          (hex && likedColors.includes(hex)) ||
          (name && likedColors.some((c) => name.includes(c)))
        ) {
          mod += 8;
          prioritized = true;
        }
      }

      return { modifier: mod, isPrioritized: prioritized && mod > 0 && !hasDisliked };
    };

    // 1. Candidatas: todas las parejas superior × inferior compatibles y los vestidos
    const candidates: Candidate[] = [];
    for (const top of tops.filter(fitsSeason)) {
      for (const bottom of bottoms.filter(fitsSeason)) {
        if (top.id === bottom.id || !seasonsCompatible(top.season, bottom.season)) continue;
        const harmony = colorHarmony(top, bottom);
        const season = options.season ?? resolveSeason([top, bottom]);
        const { modifier, isPrioritized } = computeFeedbackModifier([top, bottom]);
        const occasionMod = computeOccasionModifier([top, bottom], options.occasion);
        const weatherMod = computeWeatherModifier(
          [top, bottom],
          options.weatherCondition,
          options.temperature,
        );

        candidates.push({
          type: 'dos_piezas',
          core: [top, bottom],
          harmony,
          season,
          priority:
            harmonyPriority(harmony) +
            seasonPriority(top.season, bottom.season) +
            modifier +
            occasionMod +
            weatherMod,
          wear: (top.wearCount ?? 0) + (bottom.wearCount ?? 0),
          key: `${top.id}|${bottom.id}`,
          isPrioritized,
        });
      }
    }
    for (const dress of onePieces.filter(fitsSeason)) {
      const { modifier, isPrioritized } = computeFeedbackModifier([dress]);
      const occasionMod = computeOccasionModifier([dress], options.occasion);
      const weatherMod = computeWeatherModifier(
        [dress],
        options.weatherCondition,
        options.temperature,
      );

      candidates.push({
        type: 'cuerpo_entero',
        core: [dress],
        harmony: 'pieza_unica',
        season: options.season ?? resolveSeason([dress]),
        priority: 2 + modifier + occasionMod + weatherMod,
        wear: (dress.wearCount ?? 0) * 2,
        key: dress.id,
        isPrioritized,
      });
    }

    // 1b. Motor de outfits: paleta personal, armonía, coherencia de estilo y Style DNA.
    // Su puntuación (0-1) se escala a 0-30 para pesar como las reglas de ocasión y clima.
    if (ctx) {
      for (const c of candidates) {
        const scored = scoreOutfit(c.core.map((g) => withRole(g, c.type)), ctx);
        c.score = scored.score;
        c.highlights = scored.breakdown
          .filter((b) => b.score >= 0.8 && ['Paleta personal', 'Armonía de colores', 'Coherencia de estilo', 'Style DNA'].includes(b.factor))
          .map((b) => b.detail.split('; ')[0]);
        c.priority += scored.score * 30;
        // Una prenda con un color que la usuaria declaró evitar baja mucho
        if (c.core.some((g) => garmentColorScore(toEngineGarment(g), ctx).score === 0)) c.priority -= 25;
        // HU-23: valoraciones guardadas en la cuenta (sirven en cualquier teléfono)
        if (ctx.feedback?.size) {
          const fb = outfitAffinity(ctx.feedback, c.core.map(toEngineGarment));
          c.priority += fb.value * FEEDBACK_PRIORITY - (fb.dislikedMatch ? DISLIKED_COMBINATION_PENALTY : 0);
          if (fb.dislikedMatch || fb.value < 0) c.isPrioritized = false;
          else if (fb.likedMatch || fb.value >= PRIORITIZED_AFFINITY) {
            c.isPrioritized = true;
            c.prioritizedReason = fb.detail;
          }
        }
      }
    }

    // 2. Orden: prioridad (valoraciones + temporada + ocasión + clima + color) y luego prendas menos usadas
    candidates.sort(
      (a, b) => b.priority - a.priority || a.wear - b.wear || a.key.localeCompare(b.key),
    );

    // 3. Selección con variedad: ninguna prenda principal se repite más de MAX_USES_PER_GARMENT veces
    const uses = new Map<string, number>();
    const selected: Candidate[] = [];
    for (const candidate of candidates) {
      if (selected.length >= limit) break;
      if (candidate.core.some((g) => (uses.get(g.id) ?? 0) >= MAX_USES_PER_GARMENT)) continue;
      candidate.core.forEach((g) => uses.set(g.id, (uses.get(g.id) ?? 0) + 1));
      selected.push(candidate);
    }

    // 4. Complementos: calzado y abrigo del propio armario adaptados al clima y ocasión
    const accessoryUses = new Map<string, number>();
    const pickAccessory = (
      pool: WardrobeItem[],
      season: WardrobeSeason | null,
      role: 'calzado' | 'abrigo',
      core?: WardrobeItem[],
    ) => {
      const compatible = pool.filter((i) => seasonsCompatible(i.season, season));
      if (compatible.length === 0) return null;

      const scoreAccessory = (item: WardrobeItem): number => {
        let score = 0;
        // Que combine con el conjunto: armonía de color y coherencia con las prendas principales
        if (ctx && core) {
          score += scoreOutfit([...core.map((g) => withRole(g, 'dos_piezas')), { ...toEngineGarment(item), role }], ctx).score * 20;
        }
        const sub = item.subcategory;

        if (role === 'calzado') {
          if (options.weatherCondition === 'frio' || options.weatherCondition === 'lluvia') {
            if (sub === 'botas') score += 10;
            else if (sub === 'zapatillas') score += 5;
            else if (sub === 'sandalias') score -= 20;
          } else if (options.weatherCondition === 'calido') {
            if (sub === 'sandalias') score += 10;
            else if (sub === 'zapatillas') score += 4;
            else if (sub === 'botas') score -= 15;
          }

          if (options.occasion === 'trabajo') {
            if (sub === 'tacones') score += 8;
            else if (sub === 'botas') score += 4;
            else if (sub === 'sandalias') score -= 10;
          } else if (options.occasion === 'deporte') {
            if (sub === 'zapatillas') score += 15;
            else score -= 20;
          } else if (options.occasion === 'evento') {
            if (sub === 'tacones') score += 12;
            else if (sub === 'zapatillas') score -= 10;
          }
        }
        return score;
      };

      compatible.sort(
        (a, b) =>
          scoreAccessory(b) - scoreAccessory(a) ||
          (accessoryUses.get(a.id) ?? 0) - (accessoryUses.get(b.id) ?? 0) ||
          (a.wearCount ?? 0) - (b.wearCount ?? 0) ||
          a.id.localeCompare(b.id),
      );
      const chosen = compatible[0];
      accessoryUses.set(chosen.id, (accessoryUses.get(chosen.id) ?? 0) + 1);
      return chosen;
    };

    const selectedOccasion = options.occasion ?? 'todas';
    const weatherCondition = options.weatherCondition ?? null;

    const outfits: GeneratedOutfit[] = selected.map((candidate) => {
      const pieces: OutfitPiece[] =
        candidate.type === 'cuerpo_entero'
          ? [piece('cuerpo_entero', candidate.core[0])]
          : [piece('superior', candidate.core[0]), piece('inferior', candidate.core[1])];

      const shoe = pickAccessory(shoes, candidate.season, 'calzado', candidate.core);
      if (shoe) pieces.push(piece('calzado', shoe));

      const isColdOrRain =
        options.weatherCondition === 'frio' || options.weatherCondition === 'lluvia';
      const isWarm = options.weatherCondition === 'calido';
      const needsCoat =
        (isColdOrRain ||
          (!options.weatherCondition &&
            (candidate.season === 'otono' || candidate.season === 'invierno'))) &&
        !isWarm;
      const coat = needsCoat ? pickAccessory(outerwear, candidate.season, 'abrigo', candidate.core) : null;
      if (coat) pieces.push(piece('abrigo', coat));

      return {
        id: `outfit-${pieces.map((p) => p.item.id).join('-')}`,
        type: candidate.type,
        pieces,
        season: candidate.season,
        seasonLabel: candidate.season ? SEASON_LABELS[candidate.season] : 'Sin temporada definida',
        harmony: candidate.harmony,
        harmonyLabel: HARMONY_LABELS[candidate.harmony],
        reason: buildReason(candidate, options),
        isPrioritized: candidate.isPrioritized,
        prioritizedReason: candidate.isPrioritized
          ? candidate.prioritizedReason ?? 'Propuesta priorizada a partir de tus valoraciones previas'
          : undefined,
        occasion: selectedOccasion !== 'todas' ? selectedOccasion : undefined,
        occasionLabel: selectedOccasion !== 'todas' ? OCCASION_LABELS[selectedOccasion] : undefined,
        score: candidate.score !== undefined ? Math.round(candidate.score * 100) : undefined,
        highlights: candidate.highlights,
      };
    });

    // Criterio 3: Si la información climática no está disponible, se generan combinaciones
    // solo por ocasión y se informa explícitamente a la usuaria.
    const weatherNotice = !weatherCondition
      ? 'Información climática no disponible. Se generaron combinaciones solo por la ocasión seleccionada.'
      : null;

    return {
      isSufficient: true,
      insufficient: null,
      noMatches:
        outfits.length === 0
          ? {
              title: options.season
                ? `Sin combinaciones para ${SEASON_LABELS[options.season].toLowerCase()}`
                : 'Sin combinaciones compatibles',
              message: options.season
                ? 'Tus prendas registradas no coinciden con esa temporada. Prueba con otra temporada o con "Todas".'
                : 'Tus prendas superiores e inferiores están marcadas para temporadas distintas. Revisa la temporada de alguna prenda o agrega otra.',
              ctaLabel: options.season ? 'Ver todas las temporadas' : 'Agregar prenda',
            }
          : null,
      summary,
      outfits,
      generatedAt: new Date().toISOString(),
      occasion: selectedOccasion,
      occasionLabel: OCCASION_LABELS[selectedOccasion],
      weatherCondition,
      weatherLabel: weatherCondition ? WEATHER_CONDITION_LABELS[weatherCondition] : null,
      weatherNotice,
    };
  }

  private buildInsufficient(tops: number, bottoms: number): NonNullable<OutfitsResponse['insufficient']> {
    const missing: string[] = [];
    if (tops === 0) missing.push('Una prenda superior: blusa, camisa, camiseta, top o suéter');
    if (bottoms === 0) missing.push('Una prenda inferior: pantalón, jeans, falda o shorts');
    missing.push('O bien un vestido, que funciona solo');

    return {
      title: 'Aún no hay prendas suficientes',
      message:
        'Para armar una combinación necesitas al menos una prenda superior y una inferior, o un vestido. Sólo contamos las prendas confirmadas de tu armario.',
      missing,
      ctaLabel: 'Agregar prenda',
    };
  }
}

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

/** Prenda del armario en el formato del motor de outfits, con lo que detectó la IA. */
export function toEngineGarment(item: WardrobeItem): EngineGarment {
  const ai = item.aiMetadata || {};
  return {
    id: item.id,
    name: item.name,
    category: item.category as EngineGarment['category'],
    subcategory: item.subcategory,
    color: item.color,
    colorHex: item.colorHex,
    season: item.season,
    occasion: item.occasion,
    wearCount: item.wearCount ?? 0,
    lastWornAt: item.lastWornAt ? new Date(item.lastWornAt).toISOString() : null,
    pattern: typeof ai.pattern === 'string' ? ai.pattern : null,
    styles: Array.isArray(ai.styles) ? ai.styles : [],
    aiOccasion: typeof ai.suggestedOccasion === 'string' ? ai.suggestedOccasion : null,
  };
}

function withRole(item: WardrobeItem, type: OutfitType): EngineGarment & { role: string } {
  const role = type === 'cuerpo_entero' ? 'vestido' : item.category === 'inferior' ? 'inferior' : 'superior';
  return { ...toEngineGarment(item), role };
}

function piece(role: OutfitRole, item: WardrobeItem): OutfitPiece {
  const subLabel = SUBCATEGORY_LABELS[item.subcategory] || item.subcategory;
  return {
    role,
    roleLabel: ROLE_LABELS[role],
    item: {
      id: item.id,
      name: item.name || `${subLabel} ${item.color || ''}`.trim(),
      category: item.category,
      subcategory: item.subcategory,
      categoryLabel: `${CATEGORY_LABELS[item.category] || item.category} • ${subLabel}`,
      color: item.color,
      colorHex: item.colorHex,
      season: item.season,
      photoUrl: item.enhancedImageUrl || item.originalImageUrl,
      wearCount: item.wearCount ?? 0,
      lastWornAt: item.lastWornAt ?? null,
    },
  };
}

/** Dos prendas combinan por temporada si alguna no la tiene definida, alguna es "todo el año" o coinciden. */
export function seasonsCompatible(a: WardrobeSeason | null, b: WardrobeSeason | null): boolean {
  return !a || !b || a === b || a === 'todo_el_ano' || b === 'todo_el_ano';
}

function resolveSeason(items: WardrobeItem[]): WardrobeSeason | null {
  const specific = items.find((i) => i.season && i.season !== 'todo_el_ano');
  if (specific) return specific.season;
  return items.some((i) => i.season === 'todo_el_ano') ? 'todo_el_ano' : null;
}

function seasonPriority(a: WardrobeSeason | null, b: WardrobeSeason | null): number {
  if (a && b && a === b) return 1;
  return 0;
}

function harmonyPriority(h: OutfitHarmony): number {
  switch (h) {
    case 'base_neutra':
    case 'misma_familia':
      return 2;
    case 'contraste':
      return 1;
    default:
      return 0;
  }
}

interface ColorInfo {
  neutral: boolean;
  hue: number | null;
}

function describeColor(item: WardrobeItem): ColorInfo | null {
  const hex = item.colorHex?.trim();
  if (hex && /^#?[0-9a-f]{6}$/i.test(hex)) {
    const { h, s, l } = hexToHsl(hex);
    return { neutral: s < 0.15 || l < 0.12 || l > 0.92, hue: h };
  }
  const name = item.color?.trim().toLowerCase();
  if (name) {
    return { neutral: NEUTRAL_COLOR_NAMES.some((n) => name.includes(n)), hue: null };
  }
  return null;
}

function colorHarmony(a: WardrobeItem, b: WardrobeItem): OutfitHarmony {
  const ca = describeColor(a);
  const cb = describeColor(b);
  if (!ca || !cb) return 'sin_datos';
  if (ca.neutral || cb.neutral) return 'base_neutra';
  if (ca.hue === null || cb.hue === null) return 'sin_datos';
  const diff = Math.abs(ca.hue - cb.hue);
  return Math.min(diff, 360 - diff) <= 40 ? 'misma_familia' : 'contraste';
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function colorWord(item: WardrobeItem): string {
  return item.color ? item.color.toLowerCase() : 'sin color registrado';
}

function shortName(item: WardrobeItem): string {
  return (item.name || SUBCATEGORY_LABELS[item.subcategory] || 'prenda').toLowerCase();
}

function computeOccasionModifier(
  coreItems: WardrobeItem[],
  occasion?: OutfitOccasion,
): number {
  if (!occasion || occasion === 'todas') return 0;
  let mod = 0;
  for (const item of coreItems) {
    const sub = item.subcategory;
    switch (occasion) {
      case 'trabajo':
        if (sub === 'blazers') mod += 8;
        else if (sub === 'camisas') mod += 7;
        else if (sub === 'blusas' || sub === 'pantalones') mod += 6;
        else if (sub === 'vestidos' || sub === 'tacones') mod += 4;
        else if (sub === 'chaquetas') mod += 3;
        else if (sub === 'shorts') mod -= 15;
        else if (sub === 'sandalias') mod -= 10;
        else if (sub === 'tops') mod -= 8;
        else if (sub === 'camisetas') mod -= 5;
        break;

      case 'universidad':
        if (sub === 'camisetas' || sub === 'jeans' || sub === 'zapatillas') mod += 6;
        else if (sub === 'sueteres') mod += 5;
        else if (sub === 'tops' || sub === 'chaquetas') mod += 4;
        else if (sub === 'pantalones') mod += 3;
        else if (sub === 'shorts') mod += 2;
        else if (sub === 'tacones') mod -= 12;
        else if (sub === 'blazers') mod -= 6;
        break;

      case 'evento':
        if (sub === 'vestidos') mod += 10;
        else if (sub === 'blazers' || sub === 'tacones') mod += 8;
        else if (sub === 'blusas' || sub === 'camisas' || sub === 'faldas') mod += 5;
        else if (sub === 'pantalones') mod += 4;
        else if (sub === 'shorts') mod -= 15;
        else if (sub === 'camisetas' || sub === 'zapatillas') mod -= 8;
        break;

      case 'diario':
        if (sub === 'jeans' || sub === 'camisetas') mod += 5;
        else if (sub === 'pantalones' || sub === 'blusas' || sub === 'zapatillas') mod += 4;
        else if (
          sub === 'faldas' ||
          sub === 'vestidos' ||
          sub === 'sueteres' ||
          sub === 'chaquetas'
        )
          mod += 3;
        else if (sub === 'sandalias') mod += 2;
        else if (sub === 'tacones') mod -= 3;
        break;

      case 'deporte':
        if (sub === 'zapatillas') mod += 10;
        else if (sub === 'camisetas' || sub === 'tops' || sub === 'shorts') mod += 8;
        else if (sub === 'tacones') mod -= 25;
        else if (sub === 'botas' || sub === 'blazers') mod -= 20;
        else if (sub === 'vestidos') mod -= 15;
        else if (sub === 'camisas') mod -= 12;
        else if (sub === 'faldas') mod -= 10;
        break;
    }
  }
  return mod;
}

function computeWeatherModifier(
  coreItems: WardrobeItem[],
  weatherCondition?: OutfitWeatherCondition,
  temperature?: number,
): number {
  if (!weatherCondition) return 0;
  let mod = 0;
  for (const item of coreItems) {
    const sub = item.subcategory;
    const itemSeason = item.season;

    switch (weatherCondition) {
      case 'frio':
        if (sub === 'sueteres' || sub === 'abrigos') mod += 8;
        else if (sub === 'botas') mod += 7;
        else if (sub === 'chaquetas' || sub === 'pantalones') mod += 6;
        else if (sub === 'jeans') mod += 5;
        else if (sub === 'shorts' || sub === 'sandalias') mod -= 18;
        else if (sub === 'tops') mod -= 12;
        else if (sub === 'faldas') mod -= 6;
        if (itemSeason === 'invierno' || itemSeason === 'otono') mod += 4;
        if (itemSeason === 'verano') mod -= 8;
        break;

      case 'templado':
        if (
          sub === 'camisas' ||
          sub === 'blusas' ||
          sub === 'camisetas' ||
          sub === 'jeans' ||
          sub === 'pantalones' ||
          sub === 'zapatillas'
        ) {
          mod += 4;
        } else if (sub === 'chaquetas' || sub === 'sueteres') {
          mod += 2;
        }
        break;

      case 'calido':
        if (sub === 'tops' || sub === 'shorts' || sub === 'sandalias') mod += 8;
        else if (sub === 'camisetas' || sub === 'vestidos') mod += 7;
        else if (sub === 'faldas') mod += 5;
        else if (sub === 'abrigos') mod -= 20;
        else if (sub === 'sueteres') mod -= 15;
        else if (sub === 'botas') mod -= 12;
        else if (sub === 'chaquetas') mod -= 10;
        if (itemSeason === 'verano') mod += 5;
        if (itemSeason === 'invierno') mod -= 10;
        break;

      case 'lluvia':
        if (sub === 'chaquetas' || sub === 'abrigos' || sub === 'botas') mod += 8;
        else if (sub === 'pantalones') mod += 5;
        else if (sub === 'jeans') mod += 4;
        else if (sub === 'sandalias') mod -= 20;
        else if (sub === 'shorts') mod -= 10;
        else if (sub === 'tacones') mod -= 8;
        else if (sub === 'vestidos') mod -= 5;
        break;
    }
  }

  // Si tenemos temperatura en grados, afinar bono/penalización
  if (temperature !== undefined) {
    if (temperature < 14) {
      if (coreItems.some((i) => i.subcategory === 'sueteres' || i.subcategory === 'abrigos'))
        mod += 3;
      if (coreItems.some((i) => i.subcategory === 'shorts' || i.subcategory === 'tops'))
        mod -= 5;
    } else if (temperature > 24) {
      if (
        coreItems.some(
          (i) =>
            i.subcategory === 'tops' ||
            i.subcategory === 'shorts' ||
            i.subcategory === 'sandalias',
        )
      )
        mod += 3;
      if (coreItems.some((i) => i.subcategory === 'sueteres' || i.subcategory === 'abrigos'))
        mod -= 5;
    }
  }

  return mod;
}

function buildReason(c: Candidate, options: GenerateOutfitsOptions = {}): string {
  const parts: string[] = [];

  if (c.isPrioritized) {
    // HU-23: el porqué concreto (qué prenda o color le agradó) cuando viene de la cuenta
    parts.push(c.prioritizedReason ? `Priorizada por tus valoraciones. ${c.prioritizedReason}` : 'Propuesta priorizada a partir de tus valoraciones previas.');
  }

  if (options.occasion && options.occasion !== 'todas') {
    parts.push(`Pensada para ${OCCASION_LABELS[options.occasion].toLowerCase()}.`);
  }

  if (options.weatherCondition) {
    const tempStr =
      options.temperature !== undefined ? ` (${Math.round(options.temperature)}°C)` : '';
    parts.push(
      `Apta para ${WEATHER_CONDITION_LABELS[options.weatherCondition].toLowerCase()}${tempStr}.`,
    );
  }

  if (c.type === 'cuerpo_entero') {
    parts.push(`Tu ${shortName(c.core[0])} resuelve el conjunto en una sola prenda.`);
  } else {
    const [top, bottom] = c.core;
    switch (c.harmony) {
      case 'base_neutra': {
        const neutralIsBottom = describeColor(bottom)?.neutral;
        const [base, other] = neutralIsBottom ? [bottom, top] : [top, bottom];
        parts.push(`El tono ${colorWord(base)} de tu ${shortName(base)} sirve de base para tu ${shortName(other)}.`);
        break;
      }
      case 'misma_familia':
        parts.push(`Tu ${shortName(top)} y tu ${shortName(bottom)} comparten familia de color.`);
        break;
      case 'contraste':
        parts.push(`El ${colorWord(top)} y el ${colorWord(bottom)} forman un contraste marcado.`);
        break;
      default:
        parts.push('Combinación armada por categoría y temporada; registra el color de tus prendas para afinarla.');
    }
  }

  if (c.highlights?.length) {
    const h = c.highlights[0];
    parts.push(h.endsWith('.') ? h : `${h}.`);
  }

  if (c.wear === 0) {
    parts.push('Incluye prendas que aún no has estrenado.');
  }

  return parts.join(' ');
}
