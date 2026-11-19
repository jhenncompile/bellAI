import { WardrobeCategory, WardrobeSubcategory } from '../types/wardrobe.types';

/**
 * HU-15: Propuesta del tipo de prenda a partir de su silueta.
 *
 * No hay un modelo entrenado para tipos de prenda en el proyecto (wardrobe_v1.onnx tiene una
 * sola salida), así que se usa visión clásica sobre la máscara prenda/fondo:
 *  - separación entre dos piernas en la parte baja      -> pantalón o short
 *  - hombros/mangas más anchos que el resto              -> prenda superior
 *  - se ensancha hacia abajo                             -> falda o vestido (según lo alargada)
 *  - mucho más ancha que alta                            -> calzado
 *
 * Si la silueta no encaja con claridad en ninguna regla, devuelve `null` en lugar de adivinar:
 * la pantalla de confirmación pide entonces el tipo a la usuaria (criterio 3 de la HU).
 * La confianza es cualitativa ('alta' | 'media') porque estas reglas no están calibradas
 * contra un conjunto de datos; no se muestra ningún porcentaje inventado.
 */

export type TypeConfidence = 'alta' | 'media';

export interface GarmentTypeSuggestion {
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  /** Nombre en lenguaje natural para la usuaria, ej. "Pantalón". */
  label: string;
  confidence: TypeConfidence;
  /** Qué se observó en la silueta, en lenguaje natural. */
  evidence: string;
}

export interface SilhouetteFeatures {
  /** Alto / ancho del recuadro de la prenda. */
  aspect: number;
  /** Fracción de filas inferiores con hueco central y prenda a ambos lados (0..1). */
  legGap: number;
  /** Ancho relativo (0..1 del recuadro) en la franja de hombros. */
  shoulderWidth: number;
  /** Ancho relativo en la franja superior (cintura de falda/pantalón o escote). */
  topWidth: number;
  /** Ancho relativo en la franja media. */
  midWidth: number;
  /** Ancho relativo en la franja inferior. */
  bottomWidth: number;
}

/** Mínimo de píxeles de prenda en una fila para considerarla parte del recuadro. */
const MIN_ROW_FRACTION = 0.04;

/**
 * Extrae medidas de la silueta a partir de una máscara binaria (1 = prenda, 0 = fondo).
 * Devuelve `null` si no hay una prenda delimitable.
 */
export function extractSilhouetteFeatures(
  mask: Uint8Array,
  width: number,
  height: number
): SilhouetteFeatures | null {
  const rowCounts = new Array<number>(height).fill(0);
  const colCounts = new Array<number>(width).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        rowCounts[y]++;
        colCounts[x]++;
      }
    }
  }

  const minRow = Math.max(2, Math.round(width * MIN_ROW_FRACTION));
  const minCol = Math.max(2, Math.round(height * MIN_ROW_FRACTION));
  const y0 = rowCounts.findIndex((c) => c >= minRow);
  const y1 = height - 1 - [...rowCounts].reverse().findIndex((c) => c >= minRow);
  const x0 = colCounts.findIndex((c) => c >= minCol);
  const x1 = width - 1 - [...colCounts].reverse().findIndex((c) => c >= minCol);

  if (y0 < 0 || x0 < 0 || y1 - y0 < 8 || x1 - x0 < 8) return null;

  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  /** Ancho ocupado (extremo izquierdo a extremo derecho) de una fila, relativo al recuadro. */
  const rowSpan = (y: number): number => {
    let left = -1;
    let right = -1;
    for (let x = x0; x <= x1; x++) {
      if (mask[y * width + x]) {
        if (left < 0) left = x;
        right = x;
      }
    }
    return left < 0 ? 0 : (right - left + 1) / bw;
  };

  const bandSpan = (from: number, to: number, mode: 'avg' | 'max'): number => {
    const start = y0 + Math.floor(bh * from);
    const end = Math.max(start + 1, y0 + Math.floor(bh * to));
    let acc = 0;
    let n = 0;
    for (let y = start; y < end && y <= y1; y++) {
      const s = rowSpan(y);
      acc = mode === 'max' ? Math.max(acc, s) : acc + s;
      n++;
    }
    if (n === 0) return 0;
    return mode === 'max' ? acc : acc / n;
  };

  // Hueco entre piernas: en el 35 % inferior, la fila tiene dos tramos de prenda
  // (piernas) separados por fondo cerca del centro del recuadro.
  const minSegment = Math.max(2, Math.round(bw * 0.04));
  const minLeg = bw * 0.15;
  const minGap = Math.max(2, Math.round(bw * 0.03));

  const hasLegGap = (y: number): boolean => {
    const segments: [number, number][] = [];
    let start = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const on = x <= x1 && mask[y * width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minSegment) segments.push([start, x - 1]);
        start = -1;
      }
    }
    for (let i = 0; i < segments.length - 1; i++) {
      const gapStart = segments[i][1] + 1;
      const gapEnd = segments[i + 1][0] - 1;
      const gapCenter = ((gapStart + gapEnd) / 2 - x0) / bw;
      if (gapEnd - gapStart + 1 < minGap || gapCenter < 0.3 || gapCenter > 0.7) continue;
      const leftWidth = segments[i][1] - segments[0][0] + 1;
      const rightWidth = segments[segments.length - 1][1] - segments[i + 1][0] + 1;
      if (leftWidth >= minLeg && rightWidth >= minLeg) return true;
    }
    return false;
  };

  let gapRows = 0;
  let checkedRows = 0;
  for (let y = y0 + Math.floor(bh * 0.65); y <= y1 - Math.floor(bh * 0.03); y++) {
    checkedRows++;
    if (hasLegGap(y)) gapRows++;
  }

  return {
    aspect: bh / bw,
    legGap: checkedRows > 0 ? gapRows / checkedRows : 0,
    shoulderWidth: bandSpan(0.1, 0.4, 'max'),
    topWidth: bandSpan(0.02, 0.15, 'avg'),
    midWidth: bandSpan(0.45, 0.6, 'avg'),
    bottomWidth: bandSpan(0.75, 0.95, 'avg'),
  };
}

/**
 * Aplica las reglas de silueta. Devuelve una propuesta coherente con la geometría de la prenda.
 */
export function classifySilhouette(f: SilhouetteFeatures): GarmentTypeSuggestion | null {
  // Calzado: claramente más ancho que alto (zapato de perfil)
  if (f.aspect < 0.70) {
    return {
      category: 'calzado',
      subcategory: 'zapatillas',
      label: 'Calzado',
      confidence: f.aspect < 0.55 ? 'alta' : 'media',
      evidence: 'La silueta es mucho más ancha que alta, como un calzado de perfil.',
    };
  }

  // Dos piernas separadas en la parte baja (bifurcación anatómica de pantalón o short)
  if (f.legGap >= 0.20) {
    const long = f.aspect >= 1.15;
    return {
      category: 'inferior',
      subcategory: long ? 'pantalones' : 'shorts',
      label: long ? 'Pantalón' : 'Short',
      confidence: f.legGap >= 0.35 ? 'alta' : 'media',
      evidence: long
        ? 'Se detectó bifurcación de piernas y silueta alargada de pantalón.'
        : 'Se ven dos piernas cortas separadas.',
    };
  }

  const hasShoulders =
    f.shoulderWidth >= f.midWidth * 1.15 && f.shoulderWidth >= f.bottomWidth * 1.10;
  const widensDown = f.bottomWidth >= f.topWidth * 1.25 && f.bottomWidth >= f.midWidth * 1.05;

  if (widensDown && f.aspect >= 1.40) {
    return {
      category: 'superior',
      subcategory: 'vestidos',
      label: 'Vestido',
      confidence: hasShoulders || f.bottomWidth >= f.midWidth * 1.25 ? 'alta' : 'media',
      evidence: 'Es una prenda larga que se ensancha hacia abajo.',
    };
  }

  if (widensDown && f.aspect >= 0.70 && f.aspect < 1.40 && !hasShoulders) {
    return {
      category: 'inferior',
      subcategory: 'faldas',
      label: 'Falda',
      confidence: f.bottomWidth >= f.topWidth * 1.35 ? 'alta' : 'media',
      evidence: 'Más angosta en la cintura y más ancha abajo, sin separación de piernas.',
    };
  }

  if (f.aspect >= 1.35 && !widensDown) {
    return {
      category: 'inferior',
      subcategory: 'pantalones',
      label: 'Pantalón',
      confidence: 'media',
      evidence: 'Silueta alargada verticalmente correspondiente a prenda inferior.',
    };
  }

  if (hasShoulders || f.shoulderWidth >= f.midWidth * 1.15) {
    const isShirt = f.aspect >= 1.10;
    return {
      category: 'superior',
      subcategory: isShirt ? 'camisas' : 'camisetas',
      label: isShirt ? 'Camisa' : 'Camiseta',
      confidence: 'alta',
      evidence: 'Hombros o mangas más anchos que el cuerpo de la prenda.',
    };
  }

  if (f.aspect >= 1.15) {
    return {
      category: 'superior',
      subcategory: 'camisas',
      label: 'Camisa',
      confidence: 'media',
      evidence: 'Proporción vertical de prenda superior.',
    };
  }

  return {
    category: 'superior',
    subcategory: 'camisetas',
    label: 'Prenda superior',
    confidence: 'media',
    evidence: 'Corte estándar de prenda superior.',
  };
}

/** Atajo: de máscara a propuesta (o `null` si la silueta no es concluyente). */
export function suggestGarmentType(
  mask: Uint8Array,
  width: number,
  height: number
): GarmentTypeSuggestion | null {
  const features = extractSilhouetteFeatures(mask, width, height);
  return features ? classifySilhouette(features) : null;
}
