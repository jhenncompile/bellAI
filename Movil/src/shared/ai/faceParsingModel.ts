import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import { NativeModules, Platform } from 'react-native';

/**
 * Face parsing en el teléfono: BiSeNet con backbone ResNet-18 entrenado en CelebAMask-HQ
 * (github.com/yakhyo/face-parsing, licencia MIT). Es el MISMO archivo .onnx que usa el servicio
 * de IA del servidor, ejecutado aquí con onnxruntime-react-native.
 *
 * Clasifica cada píxel del rostro en 19 clases (piel, cejas, ojos, gafas, nariz, labios,
 * cabello, sombrero…), así que el color de piel y de cabello se mide sobre los píxeles correctos
 * y no sobre un punto fijo de la foto.
 *
 * El modelo (53 MB) no va dentro de la app: se descarga una vez, en segundo plano y con conexión,
 * y queda guardado para usarse sin conexión. Mientras no esté, el análisis local sigue sin él.
 */

const MODEL_URL = 'https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx';
/** Tamaño exacto del archivo publicado: si no coincide, se descarta la descarga. */
const MODEL_BYTES = 53205364;
const MODEL_DIR = `${FileSystem.documentDirectory ?? ''}models/`;
const MODEL_PATH = `${MODEL_DIR}face_parsing_resnet18.onnx`;
const SIZE = 512;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export const FP = {
  SKIN: 1,
  L_EYE: 4,
  R_EYE: 5,
  GLASSES: 6,
  U_LIP: 12,
  L_LIP: 13,
  HAIR: 17,
  HAT: 18,
} as const;

export interface FaceParse {
  /** Clase de cada píxel, SIZE x SIZE (fila por fila). */
  labels: Uint8Array;
  /** Píxeles RGBA del mismo recorte, SIZE x SIZE. */
  rgba: Uint8Array;
  size: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

type OrtModule = typeof import('onnxruntime-react-native');
let ort: OrtModule | null | undefined;
let session: import('onnxruntime-react-native').InferenceSession | null = null;
let downloading: Promise<boolean> | null = null;

/** El módulo nativo solo existe en la app compilada (no en Expo Go ni entornos sin bridge): se carga con cuidado. */
function loadOrt(): OrtModule | null {
  if (ort !== undefined) return ort;
  if (Platform.OS === 'web') {
    ort = null;
    return null;
  }

  // onnxruntime-react-native ejecuta Module.install() a nivel raíz de archivo importado,
  // requiriendo que NativeModules.Onnxruntime exista. Si no está en el puente nativo
  // (New Architecture sin TurboModule, Expo Go o fallo de carga nativa),
  // require() causaría TypeError: Cannot read property 'install' of null.
  const hasNativeBridge = Boolean(
    (NativeModules as Record<string, unknown> | undefined)?.Onnxruntime ??
    (globalThis as Record<string, unknown> | undefined)?.OrtApi
  );

  if (!hasNativeBridge) {
    ort = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ort = require('onnxruntime-react-native') as OrtModule;
  } catch {
    ort = null;
  }
  return ort;
}

async function modelOnDisk(): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && !info.isDirectory && info.size === MODEL_BYTES;
}

/**
 * Descarga el modelo si falta. Pensado para llamarse en segundo plano (no bloquea el análisis).
 * Devuelve true si el modelo queda listo en el teléfono.
 */
export function prefetchFaceParsingModel(): Promise<boolean> {
  if (!loadOrt()) return Promise.resolve(false);
  if (downloading) return downloading;
  downloading = (async () => {
    try {
      if (await modelOnDisk()) return true;
      await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true }).catch(() => undefined);
      const tmp = `${MODEL_PATH}.part`;
      await FileSystem.deleteAsync(tmp, { idempotent: true });
      const res = await FileSystem.downloadAsync(MODEL_URL, tmp);
      const info = await FileSystem.getInfoAsync(tmp);
      if (res.status !== 200 || !info.exists || info.size !== MODEL_BYTES) {
        await FileSystem.deleteAsync(tmp, { idempotent: true });
        return false;
      }
      await FileSystem.moveAsync({ from: tmp, to: MODEL_PATH });
      return true;
    } catch (err) {
      console.warn('[FaceParsing] No se pudo descargar el modelo:', err);
      return false;
    } finally {
      downloading = null;
    }
  })();
  return downloading;
}

/** true si el modelo ya está descargado y el runtime nativo disponible. */
export async function isFaceParsingReady(): Promise<boolean> {
  return Boolean(loadOrt()) && (await modelOnDisk());
}

async function getSession() {
  const mod = loadOrt();
  if (!mod) throw new Error('El motor de modelos no está disponible en esta versión de la app.');
  if (!session) session = await mod.InferenceSession.create(MODEL_PATH);
  return session;
}

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    out[p++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, p);
}

/**
 * Segmenta el rostro. `crop` (en píxeles de la imagen original) debe rodear la cara con margen
 * para cabello y cuello, como en los datos de entrenamiento.
 */
export async function parseFace(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number },
): Promise<FaceParse> {
  const mod = loadOrt();
  if (!mod) throw new Error('El motor de modelos no está disponible en esta versión de la app.');
  const img = await manipulateAsync(uri, [{ crop }, { resize: { width: SIZE, height: SIZE } }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!img.base64) throw new Error('No se pudo leer la foto.');
  const decoded = decodeJpeg(base64ToBytes(img.base64), { useTArray: true, tolerantDecoding: true });
  if (decoded.width !== SIZE || decoded.height !== SIZE) throw new Error('Tamaño de imagen inesperado.');
  const rgba = decoded.data as Uint8Array;

  // HWC RGBA 0..255 -> CHW RGB normalizado como en ImageNet
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (rgba[i * 4] / 255 - MEAN[0]) / STD[0];
    input[plane + i] = (rgba[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    input[2 * plane + i] = (rgba[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }
  const sess = await getSession();
  const feeds = { [sess.inputNames[0]]: new mod.Tensor('float32', input, [1, 3, SIZE, SIZE]) };
  const out = await sess.run(feeds);
  const logits = out[sess.outputNames[0]].data as Float32Array; // [1, 19, SIZE, SIZE]
  const classes = logits.length / plane;

  const labels = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    let best = 0;
    let bestVal = logits[i];
    for (let c = 1; c < classes; c++) {
      const v = logits[c * plane + i];
      if (v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    labels[i] = best;
  }
  return { labels, rgba, size: SIZE };
}

/** Número de píxeles de las clases indicadas. */
export function countClass(parse: FaceParse, classes: number[]): number {
  let n = 0;
  for (let i = 0; i < parse.labels.length; i++) if (classes.includes(parse.labels[i])) n++;
  return n;
}

/** Mediana por canal de los píxeles de las clases indicadas (robusta a brillos y sombras). */
export function medianColor(parse: FaceParse, classes: number[]): Rgb | null {
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < parse.labels.length; i++) {
    if (!classes.includes(parse.labels[i])) continue;
    r.push(parse.rgba[i * 4]);
    g.push(parse.rgba[i * 4 + 1]);
    b.push(parse.rgba[i * 4 + 2]);
  }
  if (r.length < 50) return null;
  const med = (v: number[]) => {
    v.sort((x, y) => x - y);
    return v[Math.floor(v.length / 2)];
  };
  return { r: med(r), g: med(g), b: med(b) };
}
