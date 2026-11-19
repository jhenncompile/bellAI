import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import * as FileSystem from 'expo-file-system/legacy';
import { GarmentTypeSuggestion, suggestGarmentType } from './garmentTypeClassifier';
import { privacyService } from '@/features/privacy/api/privacyService';
import { ApiConfig } from '@/shared/api/apiConfig';
import { getAuthToken } from '@/shared/api/apiClient';
import { applyGains, gainsFromBackground, summarizeGarmentColors, type Rgb as ColorRgb } from '@/shared/lib/garmentColor';
import {
  SUBCATEGORY_LABELS,
  SUBCATEGORY_TO_CATEGORY,
  WardrobeCategory,
  WardrobeSubcategory,
} from '../types/wardrobe.types';

export interface ExtractedColor {
  hex: string;
  percentage: number;
  rgb: { r: number; g: number; b: number };
  name?: string;
}

export interface GarmentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * - `completo`: se propusieron tipo y color.
 * - `parcial`: sólo uno de los dos; el otro lo completa la usuaria.
 * - `fallido`: no se pudo proponer nada; se completan ambos a mano.
 */
export type GarmentAnalysisStatus = 'completo' | 'parcial' | 'fallido';

export interface GarmentAnalysisResult {
  photoUri: string;
  status: GarmentAnalysisStatus;
  /** Tipo propuesto (HU-15) o `null` si la silueta no fue concluyente. */
  typeSuggestion: GarmentTypeSuggestion | null;
  /** Color principal propuesto o `null` si no se pudo aislar la prenda. */
  dominantColor: ExtractedColor | null;
  palette: ExtractedColor[];
  colorName: string | null;
  garmentBox: GarmentBox;
  garmentContour: [number, number][];
  /** Motivos en lenguaje natural de lo que no se pudo identificar (qué pasó y qué hacer). */
  issues: string[];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = base64.length;
  let bufferLength = Math.floor(len * 0.75);
  if (base64[len - 1] === '=') bufferLength--;
  if (base64[len - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = chars.indexOf(base64[i]);
    const e2 = chars.indexOf(base64[i + 1]);
    const e3 = chars.indexOf(base64[i + 2]);
    const e4 = chars.indexOf(base64[i + 3]);

    if (e1 === -1 || e2 === -1) break;

    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== -1 && base64[i + 2] !== '=') {
      bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    }
    if (e4 !== -1 && base64[i + 3] !== '=') {
      bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
    }
  }
  return bytes;
}

/**
 * Genera una silueta vectorial estilística adaptada exactamente al cuadro y corte de la prenda
 * Garantiza que NUNCA trace el marco exterior de la foto.
 */
export function generateGarmentSilhouette(box: GarmentBox, category = 'Tops'): [number, number][] {
  const cx = box.x + box.width * 0.5;
  const top = box.y;
  const btm = box.y + box.height;
  const w = box.width;
  const h = box.height;

  if (category === 'Pantalones') {
    return [
      // Cintura centro
      [cx, top + h * 0.02],
      [cx + w * 0.32, top + h * 0.02],
      // Cadera derecha
      [cx + w * 0.35, top + h * 0.28],
      // Pierna derecha exterior
      [cx + w * 0.32, btm],
      // Pierna derecha interior
      [cx + w * 0.08, btm],
      // Tiro central
      [cx, top + h * 0.42],
      // Pierna izquierda interior
      [cx - w * 0.08, btm],
      // Pierna izquierda exterior
      [cx - w * 0.32, btm],
      // Cadera izquierda
      [cx - w * 0.35, top + h * 0.28],
      [cx - w * 0.32, top + h * 0.02],
    ];
  }

  if (category === 'Vestidos') {
    return [
      // Escote
      [cx, top + h * 0.08],
      [cx + w * 0.14, top + h * 0.04],
      // Hombro derecho
      [cx + w * 0.34, top + h * 0.08],
      // Sisa derecha
      [cx + w * 0.28, top + h * 0.28],
      // Cintura entallada
      [cx + w * 0.20, top + h * 0.46],
      // Falda evasé
      [cx + w * 0.38, btm],
      [cx, btm + h * 0.02],
      [cx - w * 0.38, btm],
      // Cintura izquierda
      [cx - w * 0.20, top + h * 0.46],
      // Sisa izquierda
      [cx - w * 0.28, top + h * 0.28],
      // Hombro izquierdo
      [cx - w * 0.34, top + h * 0.08],
      [cx - w * 0.14, top + h * 0.04],
    ];
  }

  // Por defecto Tops (Camisa / Blusa / Camiseta)
  return [
    // Cuello centro
    [cx, top + h * 0.08],
    // Cuello derecho
    [cx + w * 0.14, top + h * 0.04],
    // Hombro derecho
    [cx + w * 0.36, top + h * 0.08],
    // Manga derecha externa
    [cx + w * 0.46, top + h * 0.28],
    // Manga derecha borde inferior
    [cx + w * 0.38, top + h * 0.35],
    // Sisa derecha
    [cx + w * 0.28, top + h * 0.32],
    // Costado derecho
    [cx + w * 0.26, top + h * 0.65],
    // Bajo derecho
    [cx + w * 0.28, btm],
    // Bajo centro
    [cx, btm + h * 0.01],
    // Bajo izquierdo
    [cx - w * 0.28, btm],
    // Costado izquierdo
    [cx - w * 0.26, top + h * 0.65],
    // Sisa izquierda
    [cx - w * 0.28, top + h * 0.32],
    // Manga izquierda borde inferior
    [cx - w * 0.38, top + h * 0.35],
    // Manga izquierda externa
    [cx - w * 0.46, top + h * 0.28],
    // Hombro izquierdo
    [cx - w * 0.36, top + h * 0.08],
    // Cuello izquierdo
    [cx - w * 0.14, top + h * 0.04],
  ];
}

const ANALYSIS_WIDTH = 160;
/** Distancia RGB por debajo de la cual un píxel se considera fondo. */
const BACKGROUND_TOLERANCE = 34;
/** Si las esquinas difieren más que esto entre sí, el fondo no es liso. */
const MAX_CORNER_SPREAD = 70;

const DEFAULT_BOX: GarmentBox = { x: 0.18, y: 0.14, width: 0.64, height: 0.72 };

const ISSUES = {
  busyBackground:
    'No pudimos separar la prenda del fondo. Para una mejor propuesta, fotografíala extendida sobre una superficie lisa.',
  fillsFrame:
    'La prenda ocupa toda la foto y no se ve su forma completa. Elige el tipo abajo o vuelve a tomar la foto un poco más lejos.',
  inconclusiveShape: 'La forma de la prenda no fue concluyente. Elige el tipo abajo.',
  blendsWithBackground:
    'No distinguimos la prenda del fondo, quizá porque tienen un color parecido. Completa el tipo y el color abajo.',
  noColor: 'No pudimos determinar el color con claridad. Escríbelo abajo.',
  unreadable: 'No pudimos analizar la foto. Completa el tipo y el color abajo.',
} as const;

function contourCategoryFor(suggestion: GarmentTypeSuggestion | null): string {
  if (!suggestion) return 'Tops';
  if (suggestion.subcategory === 'vestidos') return 'Vestidos';
  if (suggestion.category === 'inferior') return 'Pantalones';
  return 'Tops';
}

function failedAnalysis(imageUri: string, issue: string): GarmentAnalysisResult {
  return {
    photoUri: imageUri,
    status: 'fallido',
    typeSuggestion: null,
    dominantColor: null,
    palette: [],
    colorName: null,
    garmentBox: DEFAULT_BOX,
    garmentContour: generateGarmentSilhouette(DEFAULT_BOX, 'Tops'),
    issues: [issue],
  };
}

type Rgb = readonly [number, number, number];

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 30, g: 30, b: 30 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** Explica en lenguaje natural qué modelo del servidor decidió el tipo de prenda. */
function garmentEvidence(method?: string, confidence?: number | null): string {
  const pct = typeof confidence === 'number' ? ` (${Math.round(confidence * 100)} % de probabilidad)` : '';
  switch (method) {
    case 'resnet34_imagenet+clip':
      return `Reconocida por dos modelos de visión que coinciden${pct}.`;
    case 'resnet34_imagenet':
      return `Reconocida por el modelo de visión del armario${pct}.`;
    case 'clip_zero_shot':
      return `Reconocida comparando la foto con descripciones de prendas${pct}.`;
    default:
      return 'Ningún modelo reconoció la prenda con seguridad: confirma el tipo.';
  }
}

/**
 * Analiza la foto de una prenda (HU-15) mediante el modelo de visión ResNet-34:
 * 1. Consulta prioritariamente el backend con PyTorch ResNet-34 para extraer características y clasificar.
 * 2. Si no hay conexión, recurre a visión morfológica on-device calibrada con bifurcación de silueta.
 * 3. Extrae color dominante real y delimita la silueta textil sin inventar datos.
 */
export async function analyzeGarmentImage(imageUri: string): Promise<GarmentAnalysisResult> {
  await privacyService.assertPhotoAnalysisConsent();

  // 1. Servidor: ResNet-34 (ImageNet) + CLIP deciden el tipo; el color se mide en la foto
  const aiMode = ApiConfig.getAiMode();
  const isRemoteConfigured = ApiConfig.isRemoteConfigured();

  if (aiMode !== 'local' && isRemoteConfigured) {
    try {
      const remoteUrl = ApiConfig.getGarmentEndpoint();
      const token = getAuthToken();
      const uploadResult = await FileSystem.uploadAsync(remoteUrl, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        // La ruta exige sesión: sin el token responde 401 y se usaría el análisis local
        headers: token ? { Accept: 'application/json', Authorization: `Bearer ${token}` } : { Accept: 'application/json' },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const backendData = JSON.parse(uploadResult.body);
        if (backendData && (backendData.subcategory || backendData.category)) {
          const rawSub = backendData.subcategory as WardrobeSubcategory;
          const subcat: WardrobeSubcategory = rawSub || 'camisetas';
          const cat: WardrobeCategory =
            (backendData.category as WardrobeCategory) || SUBCATEGORY_TO_CATEGORY[subcat] || 'superior';
          const label = backendData.label || SUBCATEGORY_LABELS[subcat] || 'Prenda';
          const colorName = backendData.color || 'Negro';
          const colorHex = backendData.color_hex || '#18181B';
          const rgb = hexToRgb(colorHex);

          // Colores medidos por el servidor (luz corregida, CIEDE2000 + CLIP para el principal):
          // se ofrecen como alternativas en la confirmación en vez de quedarse solo con el primero
          const toPct = (share: unknown) => {
            const n = Number(share);
            return Number.isFinite(n) ? Math.round(n * (n <= 1 ? 100 : 1)) : 0;
          };
          const serverColors: { name?: string; hex?: string; share?: number }[] = Array.isArray(backendData.colors)
            ? backendData.colors
            : [];
          const dominantColor: ExtractedColor = {
            hex: colorHex,
            name: colorName,
            percentage: toPct(serverColors[0]?.share),
            rgb,
          };
          const palette: ExtractedColor[] = [dominantColor];
          for (const c of serverColors.slice(1)) {
            if (!c?.hex || palette.some((p) => p.name === c.name)) continue;
            palette.push({ hex: c.hex, name: c.name, percentage: toPct(c.share), rgb: hexToRgb(c.hex) });
          }

          const garmentBox: GarmentBox = backendData.garment_box || DEFAULT_BOX;
          const typeSuggestion: GarmentTypeSuggestion = {
            category: cat,
            subcategory: subcat,
            label,
            // Sin probabilidad del modelo (null) no se afirma confianza alta
            confidence: typeof backendData.confidence === 'number' && backendData.confidence >= 0.7 && !backendData.lowConfidence ? 'alta' : 'media',
            evidence: garmentEvidence(backendData.method, backendData.confidence),
          };

          return {
            photoUri: imageUri,
            status: 'completo',
            typeSuggestion,
            dominantColor,
            palette: palette.slice(0, 4),
            colorName,
            garmentBox,
            garmentContour: generateGarmentSilhouette(garmentBox, contourCategoryFor(typeSuggestion)),
            issues: [],
          };
        }
      }
    } catch (remoteErr) {
      console.warn('[AURA Garment Vision] El servidor no respondió, se usa el análisis local:', remoteErr);
    }
  }

  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    const manipulated = await manipulateAsync(
      imageUri,
      [{ resize: { width: ANALYSIS_WIDTH } }],
      { format: SaveFormat.JPEG, base64: true }
    );
    if (!manipulated.base64) {
      return failedAnalysis(imageUri, ISSUES.unreadable);
    }
    const bytes = base64ToUint8Array(manipulated.base64);
    decoded = decodeJpeg(bytes, { useTArray: true, tolerantDecoding: true });
  } catch (error) {
    console.warn('[garmentImageAnalyzer] No se pudo leer la foto:', error);
    return failedAnalysis(imageUri, ISSUES.unreadable);
  }

  const { width: w, height: h, data } = decoded;
  const issues: string[] = [];

  // 1. Modelo de fondo: color medio de cada esquina
  const patch = Math.max(3, Math.floor(w * 0.08));
  const cornerMean = (right: boolean, bottom: boolean): Rgb => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
        const x = right ? w - 1 - dx : dx;
        const y = bottom ? h - 1 - dy : dy;
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    return [r / n, g / n, b / n];
  };
  const corners: Rgb[] = [
    cornerMean(false, false),
    cornerMean(true, false),
    cornerMean(false, true),
    cornerMean(true, true),
  ];

  let cornerSpread = 0;
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      cornerSpread = Math.max(cornerSpread, rgbDistance(corners[i], corners[j]));
    }
  }
  const backgroundIsPlain = cornerSpread <= MAX_CORNER_SPREAD;

  // Detección de letterboxing exterior (bordes negros/oscuros en capturas de pantalla)
  const isOuterBlack = corners.every((c) => c[0] < 40 && c[1] < 40 && c[2] < 40);
  let canvasBg: Rgb | null = null;
  if (isOuterBlack) {
    const lx = Math.floor(w * 0.15);
    const ly = Math.floor(h * 0.15);
    const i1 = (ly * w + lx) * 4;
    canvasBg = [data[i1], data[i1 + 1], data[i1 + 2]];
  }

  // 2. Máscara prenda/fondo excluyendo tanto marco exterior como lienzo blanco
  const mask = new Uint8Array(w * h);
  let fgCount = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px: Rgb = [data[i], data[i + 1], data[i + 2]];
      const isBackground =
        corners.some((c) => rgbDistance(px, c) < BACKGROUND_TOLERANCE) ||
        (canvasBg !== null && rgbDistance(px, canvasBg) < BACKGROUND_TOLERANCE + 8);
      if (!isBackground) {
        mask[y * w + x] = 1;
        fgCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const fgFraction = fgCount / (w * h);
  const garmentFound = fgFraction >= 0.04;
  const fillsFrame = fgFraction >= 0.85;

  // 3. Tipo por silueta (sólo si el fondo permite ver la forma completa)
  let typeSuggestion: GarmentTypeSuggestion | null = null;
  if (!garmentFound) {
    issues.push(ISSUES.blendsWithBackground);
  } else if (!backgroundIsPlain && !isOuterBlack) {
    issues.push(ISSUES.busyBackground);
  } else if (fillsFrame) {
    issues.push(ISSUES.fillsFrame);
  } else {
    typeSuggestion = suggestGarmentType(mask, w, h);
    if (!typeSuggestion) issues.push(ISSUES.inconclusiveShape);
  }

  // 4. Color: corrección de la luz con el fondo liso, y agrupación por tono con nombres CIEDE2000
  //    (mismo criterio y paleta que el servidor, ver shared/lib/garmentColor.ts)
  const backgroundRef: ColorRgb | null = backgroundIsPlain
    ? [0, 1, 2].map((ch) => corners.reduce((s, c) => s + c[ch], 0) / corners.length) as ColorRgb
    : null;
  const gains = gainsFromBackground(backgroundRef);
  const xs = Math.floor(w * 0.25);
  const xe = Math.ceil(w * 0.75);
  const ys = Math.floor(h * 0.25);
  const ye = Math.ceil(h * 0.75);
  const samples: ColorRgb[] = [];

  for (let y = ys; y < ye; y += 2) {
    for (let x = xs; x < xe; x += 2) {
      const i = (y * w + x) * 4;
      const px: Rgb = [data[i], data[i + 1], data[i + 2]];
      const isBg =
        corners.some((c) => rgbDistance(px, c) < BACKGROUND_TOLERANCE) ||
        (canvasBg !== null && rgbDistance(px, canvasBg) < BACKGROUND_TOLERANCE + 10);
      if (!isBg) samples.push(applyGains([px[0], px[1], px[2]], gains));
    }
  }

  // Si no se muestrearon suficientes píxeles, muestrear la región central excluyendo extremos
  if (samples.length < 25) {
    for (let y = ys; y < ye; y += 2) {
      for (let x = xs; x < xe; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) continue;
        if (isOuterBlack && r < 20 && g < 20 && b < 20) continue;
        samples.push(applyGains([r, g, b], gains));
      }
    }
  }

  const palette: ExtractedColor[] =
    samples.length >= 30
      ? summarizeGarmentColors(samples).map((c) => ({
          // Se devuelve el color medido (no el de referencia de la paleta)
          hex: c.hex,
          name: c.name,
          percentage: Math.round(c.share * 100),
          rgb: { r: Math.round(c.rgb[0]), g: Math.round(c.rgb[1]), b: Math.round(c.rgb[2]) },
        }))
      : [];
  const dominantColor = palette[0] ?? null;
  if (garmentFound && !dominantColor) {
    issues.push(ISSUES.noColor);
  }

  // 5. Recuadro y contorno para la vista previa
  const garmentBox: GarmentBox =
    garmentFound && !fillsFrame && maxX > minX && maxY > minY
      ? {
          x: Math.round((minX / w) * 100) / 100,
          y: Math.round((minY / h) * 100) / 100,
          width: Math.round(((maxX - minX) / w) * 100) / 100,
          height: Math.round(((maxY - minY) / h) * 100) / 100,
        }
      : DEFAULT_BOX;

  const proposed = Number(Boolean(typeSuggestion)) + Number(Boolean(dominantColor));
  return {
    photoUri: imageUri,
    status: proposed === 2 ? 'completo' : proposed === 1 ? 'parcial' : 'fallido',
    typeSuggestion,
    dominantColor,
    palette,
    colorName: dominantColor?.name ?? null,
    garmentBox,
    garmentContour: generateGarmentSilhouette(garmentBox, contourCategoryFor(typeSuggestion)),
    issues,
  };
}
