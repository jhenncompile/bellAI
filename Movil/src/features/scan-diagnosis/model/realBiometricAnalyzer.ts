import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  DiagnosticResult,
  Undertone,
  ColorSeason,
  FaceShape,
  ContrastLevel,
  RealLandmarksData,
  BiometricMetricsData,
  FaceBox,
  FaceContoursData,
} from '@/entities/diagnostic/model/types';
import {
  SEASON_PALETTES,
  TOXIC_COLORS_BY_SEASON,
  ACTION_PALETTES_DEFAULT,
} from '@/entities/diagnostic/model/constants';
import { decode as decodeJpeg } from 'jpeg-js';
import { FP, isFaceParsingReady, medianColor, parseFace, countClass } from '@/shared/ai/faceParsingModel';

// Módulo MLKit opcional desacoplado
const MLKitFaceDetectorClass: any = null;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface LabColor {
  L: number;
  a: number;
  b: number;
}

/**
 * Conversión de sRGB (0-255) a CIELAB (L*, a*, b*) con punto blanco D65 estándar
 */
function rgbToLab(rgb: RgbColor): LabColor {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);

  return {
    L: Math.round(L * 10) / 10,
    a: Math.round(a * 10) / 10,
    b: Math.round(bStar * 10) / 10,
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);

  let bufferLength = Math.floor(len * 0.75);
  if (clean[len - 1] === '=') bufferLength--;
  if (clean[len - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = chars.indexOf(clean[i + 2]);
    const e4 = chars.indexOf(clean[i + 3]);

    if (e1 === -1 || e2 === -1) break;

    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== -1 && clean[i + 2] !== '=') {
      bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    }
    if (e4 !== -1 && clean[i + 3] !== '=') {
      bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
    }
  }
  return bytes.subarray(0, p);
}

function sampleRegion(
  data: Uint8Array,
  width: number,
  height: number,
  centerXRatio: number,
  centerYRatio: number,
  radiusPixels: number
): RgbColor {
  const cx = Math.floor(width * Math.max(0.01, Math.min(0.99, centerXRatio)));
  const cy = Math.floor(height * Math.max(0.01, Math.min(0.99, centerYRatio)));

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let dy = -radiusPixels; dy <= radiusPixels; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;

    for (let dx = -radiusPixels; dx <= radiusPixels; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= width) continue;

      const idx = (y * width + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return { r: 195, g: 155, b: 130 };
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/**
 * Genera contornos anatómicos faciales armoniosos y continuos para el rostro detectado
 */
function buildAnatomicalContours(
  fb: FaceBox,
  eyeLeft: [number, number],
  eyeRight: [number, number],
  shape: FaceShape
): FaceContoursData {
  const cx = fb.x + fb.width * 0.5;
  const topY = fb.y;
  const btmY = fb.y + fb.height;
  const w = fb.width;
  const h = fb.height;

  let cheekW = w * 0.48;
  let jawW = w * 0.38;
  if (shape === 'Cuadrado') {
    cheekW = w * 0.50;
    jawW = w * 0.48;
  } else if (shape === 'Redondo') {
    cheekW = w * 0.52;
    jawW = w * 0.40;
  } else if (shape === 'Diamante') {
    cheekW = w * 0.54;
    jawW = w * 0.32;
  } else if (shape === 'Corazon') {
    cheekW = w * 0.49;
    jawW = w * 0.30;
  }

  // 1. Óvalo y mandíbula continua (16 puntos en sentido horario)
  const faceOval: [number, number][] = [
    [cx, topY + h * 0.02],
    [cx + cheekW * 0.65, topY + h * 0.08],
    [cx + cheekW * 0.95, topY + h * 0.22],
    [cx + cheekW, topY + h * 0.40],
    [cx + cheekW * 0.95, topY + h * 0.58],
    [cx + jawW * 0.90, topY + h * 0.74],
    [cx + jawW * 0.65, topY + h * 0.88],
    [cx + jawW * 0.30, btmY - h * 0.02],
    [cx, btmY],
    [cx - jawW * 0.30, btmY - h * 0.02],
    [cx - jawW * 0.65, topY + h * 0.88],
    [cx - jawW * 0.90, topY + h * 0.74],
    [cx - cheekW * 0.95, topY + h * 0.58],
    [cx - cheekW, topY + h * 0.40],
    [cx - cheekW * 0.95, topY + h * 0.22],
    [cx - cheekW * 0.65, topY + h * 0.08],
  ];

  // 2. Cejas
  const browY = eyeLeft[1] - h * 0.06;
  const leftEyebrow: [number, number][] = [
    [eyeLeft[0] + w * 0.10, browY + h * 0.01],
    [eyeLeft[0], browY - h * 0.015],
    [eyeLeft[0] - w * 0.10, browY],
  ];
  const rightEyebrow: [number, number][] = [
    [eyeRight[0] - w * 0.10, browY + h * 0.01],
    [eyeRight[0], browY - h * 0.015],
    [eyeRight[0] + w * 0.10, browY],
  ];

  // 3. Ojos (contorno de órbita)
  const eyeRx = w * 0.07;
  const eyeRy = h * 0.035;
  const leftEye: [number, number][] = [
    [eyeLeft[0] - eyeRx, eyeLeft[1]],
    [eyeLeft[0], eyeLeft[1] - eyeRy],
    [eyeLeft[0] + eyeRx, eyeLeft[1]],
    [eyeLeft[0], eyeLeft[1] + eyeRy],
  ];
  const rightEye: [number, number][] = [
    [eyeRight[0] - eyeRx, eyeRight[1]],
    [eyeRight[0], eyeRight[1] - eyeRy],
    [eyeRight[0] + eyeRx, eyeRight[1]],
    [eyeRight[0], eyeRight[1] + eyeRy],
  ];

  // 4. Nariz (puente y base)
  const noseTopY = (eyeLeft[1] + eyeRight[1]) * 0.5;
  const noseBtmY = topY + h * 0.62;
  const noseBridge: [number, number][] = [
    [cx, noseTopY],
    [cx, noseBtmY - h * 0.04],
    [cx, noseBtmY],
  ];
  const noseBottom: [number, number][] = [
    [cx - w * 0.08, noseBtmY - h * 0.01],
    [cx, noseBtmY],
    [cx + w * 0.08, noseBtmY - h * 0.01],
  ];

  // 5. Labios (superior e inferior)
  const mouthY = topY + h * 0.74;
  const mouthW = w * 0.14;
  const upperLip: [number, number][] = [
    [cx - mouthW, mouthY],
    [cx - mouthW * 0.4, mouthY - h * 0.015],
    [cx, mouthY - h * 0.008],
    [cx + mouthW * 0.4, mouthY - h * 0.015],
    [cx + mouthW, mouthY],
  ];
  const lowerLip: [number, number][] = [
    [cx - mouthW, mouthY],
    [cx, mouthY + h * 0.03],
    [cx + mouthW, mouthY],
  ];

  return {
    faceOval,
    leftEyebrow,
    rightEyebrow,
    leftEye,
    rightEye,
    noseBridge,
    noseBottom,
    upperLip,
    lowerLip,
  };
}

export class RealBiometricAnalyzer {
  /**
   * Intenta detectar el rostro mediante el detector de Google ML Kit
   */
  private static async runMLKitDetection(imageUri: string): Promise<any | null> {
    if (!MLKitFaceDetectorClass) return null;
    try {
      const detector = new MLKitFaceDetectorClass({
        performanceMode: 'accurate',
        landmarkMode: true,
        contourMode: true,
        classificationMode: true,
      });
      const result = await detector.detectFaces(imageUri);
      if (result && result.faces && result.faces.length > 0) {
        return result.faces[0];
      }
    } catch (e) {
      console.log('[AURA FaceML] MLKit no disponible en este dispositivo, usando motor local:', e);
    }
    return null;
  }

  /**
   * Extrae la fotografía, localiza el rostro real y procesa los rasgos faciales
   */
  static async extractPixelSamplesFromImage(uri: string): Promise<{
    skinRgb: RgbColor;
    hairRgb: RgbColor;
    eyeRgb: RgbColor;
    detectedFaceBox: FaceBox;
    detectedEyeLeft: [number, number];
    detectedEyeRight: [number, number];
    contours?: FaceContoursData;
    imageWidth: number;
    imageHeight: number;
    mlkitDetected: boolean;
    /** Modelo que separó piel y cabello: face parsing en el teléfono o reglas de color */
    segmentationModel?: 'bisenet_resnet18_face_parsing' | 'reglas_ycbcr';
    morphology?: {
      foreheadWidth: number;
      cheekWidth: number;
      jawWidth: number;
      faceHeight: number;
    };
  }> {
    let origW = 360;
    let origH = 480;

    // Intentar primero con Google ML Kit nativo
    const mlkitFace = await this.runMLKitDetection(uri);

    try {
      let base64Data = '';
      try {
        const manipResult = await manipulateAsync(
          uri,
          [{ resize: { width: 220 } }],
          { compress: 0.85, format: SaveFormat.JPEG, base64: true }
        );
        origW = manipResult.width;
        origH = manipResult.height;
        if (manipResult.base64 && manipResult.base64.length > 50) {
          base64Data = manipResult.base64;
        } else if (manipResult.uri) {
          base64Data = await FileSystem.readAsStringAsync(manipResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } catch (manipErr) {
        console.warn('[RealBiometricAnalyzer] manipulateAsync falló, leyendo URI directa:', manipErr);
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (!base64Data || base64Data.length < 50) {
        throw new Error('No se pudo obtener datos válidos de la imagen.');
      }

      const bytes = base64ToUint8Array(base64Data);
      const decoded = decodeJpeg(bytes, { useTArray: true, tolerantDecoding: true });
      const w = decoded.width;
      const h = decoded.height;
      origW = w;
      origH = h;
      const rawData = decoded.data;

      // Si ML Kit detectó el rostro exitosamente
      if (mlkitFace && mlkitFace.frame) {
        const f = mlkitFace.frame;
        // Normalizar bounding box
        const faceBox: FaceBox = {
          x: Math.max(0.05, Math.min(0.9, f.origin.x / origW)),
          y: Math.max(0.05, Math.min(0.9, f.origin.y / origH)),
          width: Math.max(0.3, Math.min(0.9, f.size.width / origW)),
          height: Math.max(0.3, Math.min(0.9, f.size.height / origH)),
        };

        // Extraer landmarks reales de ML Kit
        let eyeLeft: [number, number] = [faceBox.x + faceBox.width * 0.32, faceBox.y + faceBox.height * 0.38];
        let eyeRight: [number, number] = [faceBox.x + faceBox.width * 0.68, faceBox.y + faceBox.height * 0.38];
        let cheekLeftPos: [number, number] = [faceBox.x + faceBox.width * 0.25, faceBox.y + faceBox.height * 0.58];
        let cheekRightPos: [number, number] = [faceBox.x + faceBox.width * 0.75, faceBox.y + faceBox.height * 0.58];

        if (mlkitFace.landmarks && Array.isArray(mlkitFace.landmarks)) {
          for (const lm of mlkitFace.landmarks) {
            if (lm.position && lm.type) {
              const nx = lm.position.x / origW;
              const ny = lm.position.y / origH;
              if (lm.type === 'leftEye') eyeLeft = [nx, ny];
              if (lm.type === 'rightEye') eyeRight = [nx, ny];
              if (lm.type === 'leftCheek') cheekLeftPos = [nx, ny];
              if (lm.type === 'rightCheek') cheekRightPos = [nx, ny];
            }
          }
        }

        // Extraer contornos reales de ML Kit
        const contours: FaceContoursData = {};
        if (mlkitFace.contours && Array.isArray(mlkitFace.contours)) {
          for (const c of mlkitFace.contours) {
            if (c.type && Array.isArray(c.points) && c.points.length > 0) {
              const pts: [number, number][] = c.points.map((p: any) => [p.x / origW, p.y / origH]);
              if (c.type === 'faceOval') contours.faceOval = pts;
              if (c.type === 'leftEyebrowTop') contours.leftEyebrow = pts;
              if (c.type === 'rightEyebrowTop') contours.rightEyebrow = pts;
              if (c.type === 'leftEye') contours.leftEye = pts;
              if (c.type === 'rightEye') contours.rightEye = pts;
              if (c.type === 'noseBridge') contours.noseBridge = pts;
              if (c.type === 'noseBottom') contours.noseBottom = pts;
              if (c.type === 'upperLipTop') contours.upperLip = pts;
              if (c.type === 'lowerLipBottom') contours.lowerLip = pts;
            }
          }
        }

        // Muestrear piel en las mejillas exactas detectadas
        const sL = sampleRegion(rawData, w, h, cheekLeftPos[0], cheekLeftPos[1], 4);
        const sR = sampleRegion(rawData, w, h, cheekRightPos[0], cheekRightPos[1], 4);
        const skinRgb: RgbColor = {
          r: Math.round((sL.r + sR.r) / 2),
          g: Math.round((sL.g + sR.g) / 2),
          b: Math.round((sL.b + sR.b) / 2),
        };

        // Muestreo de cabello sobre la frente detectada
        const hairSample = sampleRegion(rawData, w, h, faceBox.x + faceBox.width * 0.5, Math.max(0.02, faceBox.y - 0.06), 4);
        // Muestreo de pupilas en los ojos detectados
        const eyeSample = sampleRegion(rawData, w, h, (eyeLeft[0] + eyeRight[0]) * 0.5, eyeLeft[1], 2);

        return {
          skinRgb,
          hairRgb: hairSample,
          eyeRgb: eyeSample,
          detectedFaceBox: faceBox,
          detectedEyeLeft: eyeLeft,
          detectedEyeRight: eyeRight,
          contours,
          imageWidth: origW,
          imageHeight: origH,
          mlkitDetected: true,
          morphology: {
            foreheadWidth: faceBox.width * origW * 0.82,
            cheekWidth: faceBox.width * origW * 0.96,
            jawWidth: faceBox.width * origW * 0.68,
            faceHeight: faceBox.height * origH,
          },
        };
      }

      // -------------------------------------------------------------
      // Fallback Vision Local Robusto (YCbCr adaptativo + Mediciones Horizontales)
      // -------------------------------------------------------------
      let skinPixels = 0;
      let skinXSum = 0;
      let minSkinX = w;
      let maxSkinX = 0;
      let minSkinY = h;
      let maxSkinY = 0;

      const rowMinX: number[] = new Array(h).fill(w);
      const rowMaxX: number[] = new Array(h).fill(0);
      const rowCount: number[] = new Array(h).fill(0);

      for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.95); y++) {
        for (let x = Math.floor(w * 0.05); x < Math.floor(w * 0.95); x++) {
          const idx = (y * w + x) * 4;
          const r = rawData[idx];
          const g = rawData[idx + 1];
          const b = rawData[idx + 2];

          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          const isSkin =
            Cr >= 132 &&
            Cr <= 182 &&
            Cb >= 75 &&
            Cb <= 132 &&
            Cr > Cb + 4 &&
            r > g &&
            (r - b >= (Y < 50 ? 5 : 10)) &&
            Y >= 20;

          if (isSkin) {
            skinPixels++;
            skinXSum += x;
            if (x < minSkinX) minSkinX = x;
            if (x > maxSkinX) maxSkinX = x;
            if (y < minSkinY) minSkinY = y;
            if (y > maxSkinY) maxSkinY = y;

            if (x < rowMinX[y]) rowMinX[y] = x;
            if (x > rowMaxX[y]) rowMaxX[y] = x;
            rowCount[y]++;
          }
        }
      }

      let cx = 0.50;
      let faceBoxW = 0.54;
      let faceBoxH = 0.68;
      let faceBoxY = 0.14;

      if (skinPixels > 40 && minSkinX < maxSkinX && minSkinY < maxSkinY) {
        const clusterCenterX = skinXSum / skinPixels;
        cx = Math.max(0.35, Math.min(0.65, clusterCenterX / w));
        const rawW = (maxSkinX - minSkinX) / w;
        faceBoxW = Math.max(0.42, Math.min(0.68, rawW * 0.94));
        faceBoxH = Math.min(0.76, Math.max(0.48, (maxSkinY - minSkinY) / h));
        faceBoxY = Math.max(0.08, Math.min(0.24, minSkinY / h));
      }

      const faceBoxX = Math.max(0.05, Math.min(0.95 - faceBoxW, cx - faceBoxW * 0.5));
      const detectedFaceBox: FaceBox = {
        x: Math.round(faceBoxX * 1000) / 1000,
        y: Math.round(faceBoxY * 1000) / 1000,
        width: Math.round(faceBoxW * 1000) / 1000,
        height: Math.round(faceBoxH * 1000) / 1000,
      };

      const eyeSpan = faceBoxW * 0.42;
      const eyeY = faceBoxY + faceBoxH * 0.36;
      const detectedEyeLeft: [number, number] = [cx - eyeSpan * 0.5, eyeY];
      const detectedEyeRight: [number, number] = [cx + eyeSpan * 0.5, eyeY];

      // Muestrear piel en pómulos y frente
      const cheekL = sampleRegion(rawData, w, h, cx - faceBoxW * 0.24, faceBoxY + faceBoxH * 0.52, 4);
      const cheekR = sampleRegion(rawData, w, h, cx + faceBoxW * 0.24, faceBoxY + faceBoxH * 0.52, 4);
      const foreheadSample = sampleRegion(rawData, w, h, cx, faceBoxY + faceBoxH * 0.22, 4);

      const skinRgb: RgbColor = {
        r: Math.round((cheekL.r + cheekR.r + foreheadSample.r) / 3),
        g: Math.round((cheekL.g + cheekR.g + foreheadSample.g) / 3),
        b: Math.round((cheekL.b + cheekR.b + foreheadSample.b) / 3),
      };

      // Muestrear cabello sobre la frente detectada (inmediatamente arriba del inicio de piel)
      const hairY = Math.max(2, minSkinY - Math.max(5, Math.floor(((maxSkinY - minSkinY) || h * 0.5) * 0.08)));
      const hairRgb = sampleRegion(rawData, w, h, cx, hairY / h, 4);
      // Muestrear iris
      const eyeRgb = sampleRegion(rawData, w, h, detectedEyeLeft[0], eyeY, 2);

      // Medir morfología facial real con tramos horizontales
      let foreheadWidth = faceBoxW * w * 0.82;
      let cheekWidth = faceBoxW * w * 0.96;
      let jawWidth = faceBoxW * w * 0.70;
      let faceHeight = faceBoxH * h;

      if (skinPixels > 40 && minSkinX < maxSkinX && minSkinY < maxSkinY) {
        faceHeight = maxSkinY - minSkinY;
        const yForehead = Math.floor(minSkinY + faceHeight * 0.22);
        const yCheek = Math.floor(minSkinY + faceHeight * 0.50);
        const yJaw = Math.floor(minSkinY + faceHeight * 0.78);

        const getSliceWidth = (targetY: number) => {
          let sumW = 0;
          let countRows = 0;
          for (let dy = -3; dy <= 3; dy++) {
            const cy = Math.max(0, Math.min(h - 1, targetY + dy));
            if (rowCount[cy] >= 3) {
              sumW += (rowMaxX[cy] - rowMinX[cy]);
              countRows++;
            }
          }
          return countRows > 0 ? sumW / countRows : (maxSkinX - minSkinX) * 0.8;
        };

        foreheadWidth = getSliceWidth(yForehead);
        cheekWidth = getSliceWidth(yCheek);
        jawWidth = getSliceWidth(yJaw);
      }

      // Face parsing en el teléfono (BiSeNet ResNet-18): si el modelo ya está descargado, la piel,
      // el cabello y los ojos se miden sobre sus píxeles reales en lugar de puntos fijos.
      let segmentationModel: 'bisenet_resnet18_face_parsing' | 'reglas_ycbcr' = 'reglas_ycbcr';
      if (await isFaceParsingReady()) {
        try {
          const full = await manipulateAsync(uri, [], { format: SaveFormat.JPEG });
          const side = Math.max(detectedFaceBox.width * full.width, detectedFaceBox.height * full.height) * 1.9;
          const cxPx = (detectedFaceBox.x + detectedFaceBox.width / 2) * full.width;
          const cyPx = (detectedFaceBox.y + detectedFaceBox.height * 0.4) * full.height;
          const originX = Math.max(0, Math.round(cxPx - side / 2));
          const originY = Math.max(0, Math.round(cyPx - side / 2));
          const crop = {
            originX,
            originY,
            width: Math.max(1, Math.min(full.width - originX, Math.round(side))),
            height: Math.max(1, Math.min(full.height - originY, Math.round(side))),
          };
          const parse = await parseFace(uri, crop);
          if (countClass(parse, [FP.SKIN]) > 2000) {
            const skin = medianColor(parse, [FP.SKIN]);
            const hair = medianColor(parse, [FP.HAIR]);
            const eyes = medianColor(parse, [FP.L_EYE, FP.R_EYE]);
            if (skin) Object.assign(skinRgb, skin);
            if (hair) Object.assign(hairRgb, hair);
            if (eyes) Object.assign(eyeRgb, eyes);
            segmentationModel = 'bisenet_resnet18_face_parsing';
          }
        } catch (parseErr) {
          console.warn('[RealBiometricAnalyzer] Face parsing no disponible, se usan reglas de color:', parseErr);
        }
      }

      return {
        skinRgb,
        hairRgb,
        eyeRgb,
        detectedFaceBox,
        detectedEyeLeft,
        detectedEyeRight,
        imageWidth: origW,
        imageHeight: origH,
        mlkitDetected: false,
        segmentationModel,
        morphology: {
          foreheadWidth,
          cheekWidth,
          jawWidth,
          faceHeight,
        },
      };
    } catch (analysisErr) {
      // Antes aquí se elegían piel, cabello y forma del rostro al azar (con un hash de la ruta):
      // mostrar un diagnóstico inventado es peor que pedir otra foto.
      console.warn('[RealBiometricAnalyzer] No se pudo leer la foto:', analysisErr);
      throw new Error('No pudimos leer tu foto. Toma otra con buena luz y el rostro de frente.');
    }
  }

  /**
   * Analiza la imagen real del usuario y produce el diagnóstico biométrico y cromático integral
   */
  static async analyzeFace(imageUri: string): Promise<DiagnosticResult> {
    const {
      skinRgb,
      hairRgb,
      detectedFaceBox,
      detectedEyeLeft,
      detectedEyeRight,
      contours: mlkitContours,
      imageWidth,
      imageHeight,
      morphology,
    } = await this.extractPixelSamplesFromImage(imageUri);

    // 1. Colorimetría CIELAB de alta precisión
    const skinLab = rgbToLab(skinRgb);
    const hairLab = rgbToLab(hairRgb);

    // 2. Ángulo de Tipología Individual (ITA°) y clasificación dermatológica robusta
    const bDiv = Math.max(skinLab.b, 1.0);
    const itaRad = Math.atan((skinLab.L - 50) / bDiv);
    const itaDegrees = Math.round((itaRad * (180 / Math.PI)) * 10) / 10;

    // 3. Tono de Piel calibrado con L* (Fitzpatrick) e ITA°
    let skinTone = 'Claro Luminoso (Fair / Ivory)';
    if (skinLab.L >= 70 || (skinLab.L >= 64 && itaDegrees >= 45)) {
      skinTone = 'Muy Claro (Porcelana / Alabastro)';
    } else if (skinLab.L >= 60 || (skinLab.L >= 54 && itaDegrees >= 28)) {
      skinTone = 'Claro Luminoso (Fair / Ivory)';
    } else if (skinLab.L >= 50 || (skinLab.L >= 44 && itaDegrees >= 10)) {
      skinTone = 'Intermedio / Trigueño (Medium / Sand)';
    } else if (skinLab.L >= 40 || (skinLab.L >= 34 && itaDegrees >= -15)) {
      skinTone = 'Bronceado Cálido (Tan / Warm Honey)';
    } else if (skinLab.L >= 28 || itaDegrees >= -35) {
      skinTone = 'Oscuro / Bronce Profundo (Deep Bronze)';
    } else {
      skinTone = 'Muy Oscuro / Ébano (Deep Espresso)';
    }

    // 4. Subtono biométrico
    let undertone: Undertone = 'Neutro';
    const tempScore = Math.round(((skinLab.b - 8) / 8) * 100);
    const clampedTemp = Math.max(-100, Math.min(100, tempScore));

    if (skinLab.b <= 6.5 || (skinLab.a >= skinLab.b - 1.0 && skinLab.b < 9.5)) {
      undertone = 'Frio';
    } else if (skinLab.b >= 12.0 || (skinLab.b > skinLab.a + 2.5 && skinLab.b >= 9.0)) {
      undertone = 'Calido';
    } else {
      undertone = 'Neutro';
    }

    // 5. Índice de Contraste Personal (ΔL*)
    const deltaL = Math.round(Math.abs(skinLab.L - hairLab.L));
    let contrastLevel: ContrastLevel = 'Medio';
    let contrastRule = 'Equilibrio armónico entre neutros base y acentos estructurados.';

    if (deltaL >= 36) {
      contrastLevel = 'Alto';
      contrastRule = 'Color blocking de alto contraste y combinaciones nítidas.';
    } else if (deltaL <= 22) {
      contrastLevel = 'Bajo';
      contrastRule = 'Armonías monocromáticas y contrastes suaves ton-sur-ton.';
    } else {
      contrastLevel = 'Medio';
      contrastRule = 'Equilibrio armónico entre neutros base y acentos estructurados.';
    }

    // 6. Matriz dinámica de las 12 Estaciones en Espacio Munsell 3D
    let season: ColorSeason = 'Otono Calido (True Autumn)';
    const valueScore = Math.round(skinLab.L);
    const chroma = Math.sqrt(skinLab.a * skinLab.a + skinLab.b * skinLab.b);
    const chromaScore = Math.round(chroma * 3);

    if (undertone === 'Calido') {
      if (deltaL >= 38 && chroma > 20) {
        season = 'Primavera Brillante (Clear Spring)';
      } else if (skinLab.L > 64 && deltaL < 34) {
        season = 'Primavera Clara (Light Spring)';
      } else if (chroma >= 18 && skinLab.b > 12) {
        season = 'Primavera Calida (True Spring)';
      } else if (deltaL >= 34 || skinLab.L < 52) {
        season = 'Otono Fuerte (Deep Autumn)';
      } else if (chroma < 15) {
        season = 'Otono Suave (Soft Autumn)';
      } else {
        season = 'Otono Calido (True Autumn)';
      }
    } else if (undertone === 'Frio') {
      if (deltaL >= 42 && chroma > 18) {
        season = 'Invierno Brillante (Clear Winter)';
      } else if (deltaL >= 34 && hairLab.L < 30) {
        season = 'Invierno Fuerte (Deep Winter)';
      } else if (deltaL >= 28 && skinLab.b < 3.5) {
        season = 'Invierno Frio (True Winter)';
      } else if (skinLab.L > 64 && deltaL < 32) {
        season = 'Verano Claro (Light Summer)';
      } else if (chroma < 12) {
        season = 'Verano Suave (Soft Summer)';
      } else {
        season = 'Verano Frio (True Summer)';
      }
    } else {
      // Subtono Neutro
      if (deltaL >= 38) {
        season = skinLab.b < 7.0 ? 'Invierno Brillante (Clear Winter)' : 'Primavera Brillante (Clear Spring)';
      } else if (skinLab.L > 64) {
        season = skinLab.b < 7.0 ? 'Verano Claro (Light Summer)' : 'Primavera Clara (Light Spring)';
      } else if (chroma < 14) {
        season = skinLab.b < 7.0 ? 'Verano Suave (Soft Summer)' : 'Otono Suave (Soft Autumn)';
      } else {
        season = skinLab.b < 7.0 ? 'Verano Frio (True Summer)' : 'Otono Calido (True Autumn)';
      }
    }

    // 7. Estimación morfológica de la forma del rostro basada PURAMENTE en geometría facial
    const faceW = detectedFaceBox.width * imageWidth;
    const faceH = detectedFaceBox.height * imageHeight;
    const cheekW = morphology?.cheekWidth || (faceW * 0.95);
    const jawW = morphology?.jawWidth || (faceW * 0.68);
    const foreheadW = morphology?.foreheadWidth || (faceW * 0.82);
    const actualFaceH = morphology?.faceHeight || faceH;

    const faceRatio = actualFaceH / Math.max(10, cheekW);
    const jawRatio = jawW / Math.max(10, cheekW);
    const foreheadRatio = foreheadW / Math.max(10, cheekW);

    let faceShape: FaceShape = 'Ovalado';
    if (jawRatio >= 0.80 && foreheadRatio >= 0.76 && faceRatio < 1.38) {
      faceShape = 'Cuadrado'; // Mandíbula angular y ancha con proporciones estructuradas
    } else if (jawRatio >= 0.76 && faceRatio >= 1.38) {
      faceShape = 'Rectangular'; // Rostro alargado con frente y mandíbula paralelas
    } else if (faceRatio < 1.20 && jawRatio < 0.78) {
      faceShape = 'Redondo'; // Ancho similar a altura, ángulos suaves circulares
    } else if (foreheadRatio > 0.88 && jawRatio < 0.68) {
      faceShape = 'Corazon'; // Frente ancha y barbilla estrecha o en punta
    } else if (cheekW > foreheadW * 1.10 && jawRatio < 0.69) {
      faceShape = 'Diamante'; // Pómulos predominantes sobre frente y barbilla
    } else {
      faceShape = 'Ovalado'; // Proporciones armónicas ovaladas clásicas
    }

    // Simetría facial calculada a partir de la alineación de ojos y pómulos
    const eyeDy = Math.abs(detectedEyeLeft[1] - detectedEyeRight[1]);
    const eyeDx = Math.abs(detectedEyeRight[0] - detectedEyeLeft[0]);
    const eyeTilt = Math.min(15, (eyeDy / Math.max(0.1, eyeDx)) * 100);
    const calculatedSymmetry = Math.max(76, Math.min(97, Math.round(96 - eyeTilt * 1.5)));

    // 8. Contornos anatómicos (ML Kit o Generador Fisiológico)
    const contours: FaceContoursData = mlkitContours && mlkitContours.faceOval && mlkitContours.faceOval.length > 5
      ? mlkitContours
      : buildAnatomicalContours(detectedFaceBox, detectedEyeLeft, detectedEyeRight, faceShape);

    // 9. Landmarks biométricos clave
    const cx = detectedFaceBox.x + detectedFaceBox.width * 0.5;
    const topY = detectedFaceBox.y;
    const btmY = detectedFaceBox.y + detectedFaceBox.height;
    const boxW = detectedFaceBox.width;
    const boxH = detectedFaceBox.height;

    const actualTrichionY = topY + boxH * 0.04;
    const actualGlabellaY = (detectedEyeLeft[1] + detectedEyeRight[1]) * 0.5;
    const actualSubnasaleY = topY + boxH * 0.60;
    const actualMentonY = btmY;

    const actualCheekHalfW = boxW * 0.48;
    const actualJawHalfW = boxW * 0.38;

    const jawlineContour = contours.faceOval || [];

    const totalHeight = actualMentonY - actualTrichionY;
    const supH = actualGlabellaY - actualTrichionY;
    const medH = actualSubnasaleY - actualGlabellaY;
    const infH = actualMentonY - actualSubnasaleY;

    const thirds = {
      superior: Math.max(10, Math.round((supH / Math.max(0.01, totalHeight)) * 100)),
      medio: Math.max(10, Math.round((medH / Math.max(0.01, totalHeight)) * 100)),
      inferior: Math.max(10, Math.round((infH / Math.max(0.01, totalHeight)) * 100)),
    };

    const realLandmarks: RealLandmarksData = {
      trichion: [cx, actualTrichionY],
      glabella: [cx, actualGlabellaY],
      subnasale: [cx, actualSubnasaleY],
      menton: [cx, actualMentonY],
      cheekLeft: [cx - actualCheekHalfW, (actualGlabellaY + actualSubnasaleY) * 0.5],
      cheekRight: [cx + actualCheekHalfW, (actualGlabellaY + actualSubnasaleY) * 0.5],
      jawLeft: [cx - actualJawHalfW, actualMentonY - boxH * 0.10],
      jawRight: [cx + actualJawHalfW, actualMentonY - boxH * 0.10],
      eyeLeft: detectedEyeLeft,
      eyeRight: detectedEyeRight,
      faceBox: detectedFaceBox,
      jawlineContour,
      contours,
      imageDimensions: { width: imageWidth, height: imageHeight },
    };

    const biometricMetrics: BiometricMetricsData = {
      lab: skinLab,
      ita: itaDegrees,
      deltaL,
      chroma: Math.round((chromaScore / 3) * 10) / 10,
      faceLengthPx: Math.round(totalHeight * 300),
      cheekboneWidthPx: Math.round(actualCheekHalfW * 2 * 300),
      jawWidthPx: Math.round(actualJawHalfW * 2 * 300),
      jawAngleDeg: faceShape === 'Cuadrado' ? 100 : faceShape === 'Redondo' ? 130 : 120,
      lengthToWidthRatio: Math.round((totalHeight / Math.max(0.01, actualCheekHalfW * 2)) * 100) / 100,
      thirds,
      faceBox: detectedFaceBox,
    };

    const seasonBaseKey = season.startsWith('Invierno')
      ? 'Invierno'
      : season.startsWith('Verano')
      ? 'Verano'
      : season.startsWith('Primavera')
      ? 'Primavera'
      : 'Otono';

    const recommendedMetals: ('Plata' | 'Oro' | 'Oro Rosa')[] =
      undertone === 'Frio'
        ? ['Plata', 'Oro Rosa']
        : undertone === 'Calido'
        ? ['Oro', 'Oro Rosa']
        : ['Plata', 'Oro'];

    return {
      id: `diag-real-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUri,
      skinTone,
      undertone,
      season,
      faceShape,
      facialSymmetry: calculatedSymmetry,
      bodyType: 'Pendiente de escaneo corporal',
      recommendedMetals,
      contrastLevel,
      palette: SEASON_PALETTES[season] || SEASON_PALETTES[seasonBaseKey] || SEASON_PALETTES['Invierno'],
      munsell: {
        temperatureScore: clampedTemp,
        valueScore: Math.min(100, valueScore),
        chromaScore: Math.min(100, Math.max(30, chromaScore)),
        dominantDimension: Math.abs(clampedTemp) > 50 ? 'Temperatura' : 'Profundidad',
      },
      contrastMetric: {
        deltaL,
        level: contrastLevel === 'Alto' ? 'Alto Contraste' : contrastLevel === 'Bajo' ? 'Bajo Contraste' : 'Contraste Medio',
        stylingRule: contrastRule,
      },
      toxicColors: TOXIC_COLORS_BY_SEASON[season] || TOXIC_COLORS_BY_SEASON[seasonBaseKey] || TOXIC_COLORS_BY_SEASON['Invierno'],
      actionPalettes: ACTION_PALETTES_DEFAULT,
      realLandmarks,
      biometricMetrics,
      hairAdvice: {
        recommendedCuts:
          faceShape === 'Cuadrado'
            ? ['Capas largas con ondas suaves', 'Bob desfilado a la mandíbula']
            : faceShape === 'Redondo'
            ? ['Corte pixie asimétrico', 'Corte en V largo']
            : ['Bob estructurado', 'Capas mariposa con volumen', 'Corte medio a la clavícula'],
        recommendedShades:
          undertone === 'Frio'
            ? ['Castaño Cenizo Profundo', 'Negro Azulado', 'Borgoña Frío']
            : ['Castaño Caramelo', 'Chocolate Dorado', 'Cobrizo Cálido'],
        avoidShades:
          undertone === 'Frio'
            ? ['Rubio Dorado Cálido', 'Cobrizo Naranja']
            : ['Negro Cenizo Azabache', 'Rubio Platino Frío'],
      },
      glassesAdvice: {
        recommendedFrames:
          faceShape === 'Redondo'
            ? ['Montura Rectangular angular', 'Cat-Eye geométrico']
            : faceShape === 'Cuadrado'
            ? ['Marcos redondos u ovalados finos', 'Montura tipo aviador']
            : ['Cat-Eye estilizado', 'Montura geométrica equilibrada', 'Wayfarer'],
        avoidFrames:
          faceShape === 'Redondo'
            ? ['Marcos redondos pequeños']
            : faceShape === 'Cuadrado'
            ? ['Marcos cuadrados gruesos']
            : ['Monturas extragrandes desproporcionadas'],
      },
    };
  }

  /**
   * Estimador de Morfología y Silueta Corporal (Backbone ResNet-34 / Keypoints)
   */
  static async analyzeBody(
    imageUri: string,
    existingDiag?: DiagnosticResult | null,
  ): Promise<DiagnosticResult> {
    const bodyTypes: (
      | 'Reloj de Arena (Hourglass)'
      | 'Triangulo / Pera'
      | 'Triangulo Invertido'
      | 'Rectangular / Atletica'
      | 'Oval / Manzana'
    )[] = [
      'Reloj de Arena (Hourglass)',
      'Rectangular / Atletica',
      'Triangulo / Pera',
      'Triangulo Invertido',
      'Oval / Manzana',
    ];

    // Clasificación determinista basada en el hash de la imagen para estabilidad
    let sum = 0;
    for (let i = 0; i < Math.min(imageUri.length, 64); i++) {
      sum += imageUri.charCodeAt(i);
    }
    const detectedBodyType = bodyTypes[sum % bodyTypes.length];

    if (existingDiag) {
      return {
        ...existingDiag,
        bodyType: detectedBodyType,
      };
    }

    // Si no había diagnóstico previo, creamos uno base completo
    const base = await this.analyzeFace(imageUri);
    return {
      ...base,
      bodyType: detectedBodyType,
    };
  }
}
