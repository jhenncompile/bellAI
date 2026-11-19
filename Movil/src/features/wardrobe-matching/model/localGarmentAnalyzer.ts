import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import { Undertone } from '@/entities/diagnostic/model/types';
import {
  applyGains,
  colorTemperature,
  gainsFromBackground,
  summarizeGarmentColors,
  type Rgb,
} from '@/shared/lib/garmentColor';

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

/** Color medio de una esquina de la foto (para estimar la luz si el fondo es liso). */
function cornerMean(data: Uint8Array, w: number, h: number, right: boolean, bottom: boolean): Rgb {
  const patch = Math.max(3, Math.floor(w * 0.08));
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
}

export class LocalGarmentAnalyzer {
  /**
   * Color de una prenda sin conexión, con el mismo criterio y paleta que el servidor
   * (shared/lib/garmentColor.ts): luz corregida con el fondo liso, grupos por tono y nombre CIEDE2000.
   * Si la foto no se puede leer, lanza un error con un mensaje para la usuaria: no se inventa un color.
   */
  static async analyzeGarment(
    imageUri: string,
    userUndertone: Undertone = 'Frio'
  ): Promise<{
    hexColor: string;
    colorName: string;
    temperature: 'frio' | 'calido' | 'neutro';
    seasonMatch: 'Armonia Total' | 'Aceptable' | 'No Favorece';
    compatibilityScore: number;
    tips: string;
  }> {
    let decoded: { width: number; height: number; data: Uint8Array };
    try {
      let base64Data: string;
      try {
        const manipResult = await manipulateAsync(
          imageUri,
          [{ resize: { width: 160 } }],
          { compress: 0.85, format: SaveFormat.JPEG, base64: true }
        );
        base64Data = manipResult.base64 || '';
      } catch {
        base64Data = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      decoded = decodeJpeg(base64ToUint8Array(base64Data), { useTArray: true, tolerantDecoding: true });
    } catch (err) {
      console.warn('[LocalGarmentAnalyzer] No se pudo leer la foto:', err);
      throw new Error('No pudimos leer la foto de la prenda. Vuelve a tomarla con buena luz.');
    }

    const { width: w, height: h, data } = decoded;

    // 1. Luz: si las cuatro esquinas son un fondo liso, sirven de referencia neutra
    const corners = [
      cornerMean(data, w, h, false, false),
      cornerMean(data, w, h, true, false),
      cornerMean(data, w, h, false, true),
      cornerMean(data, w, h, true, true),
    ];
    const spread = Math.max(
      ...corners.flatMap((a, i) => corners.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])))
    );
    const background: Rgb | null =
      spread <= 70 ? ([0, 1, 2].map((ch) => corners.reduce((s, c) => s + c[ch], 0) / 4) as Rgb) : null;
    const gains = gainsFromBackground(background);

    // 2. Píxeles del centro de la prenda (25 %-75 %), sin los que se parecen al fondo
    const samples: Rgb[] = [];
    for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.75); y += 2) {
      for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.75); x += 2) {
        const i = (y * w + x) * 4;
        const px: Rgb = [data[i], data[i + 1], data[i + 2]];
        if (background && Math.hypot(px[0] - background[0], px[1] - background[1], px[2] - background[2]) < 34) continue;
        samples.push(applyGains(px, gains));
      }
    }
    const main = summarizeGarmentColors(samples)[0];
    if (!main) {
      throw new Error('No distinguimos la prenda del fondo. Fotografíala sobre una superficie lisa de otro color.');
    }

    const hexColor = main.hex;
    const colorName = main.name;
    const temperature = colorTemperature(main.lab);

    // 3. Armonía con el subtono de la usuaria (regla de temperatura de color)
    let seasonMatch: 'Armonia Total' | 'Aceptable' | 'No Favorece';
    let compatibilityScore: number;
    let tips: string;
    const normalizedUserUndertone = userUndertone.toLowerCase();

    if (temperature === 'neutro') {
      seasonMatch = 'Aceptable';
      compatibilityScore = 80;
      tips = `Color neutro (${colorName}). Buena base para combinar con prendas de tu paleta.`;
    } else if (temperature === normalizedUserUndertone || normalizedUserUndertone === 'neutro') {
      seasonMatch = 'Armonia Total';
      compatibilityScore = 95;
      tips = `${colorName}: armoniza con tu subtono ${userUndertone}. Aporta luminosidad cerca del rostro.`;
    } else {
      seasonMatch = 'No Favorece';
      compatibilityScore = 48;
      tips = `${colorName} tiene una temperatura opuesta a tu subtono ${userUndertone}. Úsalo en prendas inferiores o combínalo con accesorios de tu paleta cerca del rostro.`;
    }

    return { hexColor, colorName, temperature, seasonMatch, compatibilityScore, tips };
  }
}
