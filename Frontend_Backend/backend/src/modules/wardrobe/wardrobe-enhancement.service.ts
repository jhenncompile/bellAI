import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  SUBCATEGORY_TO_CATEGORY,
  type WardrobeCategory,
  type WardrobeSubcategory,
  type WardrobeSeason,
} from './entities/wardrobe-item.entity';

export interface GarmentEnhancementResult {
  originalImageUrl: string;
  enhancedImageUrl: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  color: string;
  colorHex: string;
  approximateSize: string;
  season: WardrobeSeason;
  aiMetadata: {
    /**
     * Confianza que reporta un modelo real (FastAPI). El pipeline local con Sharp usa reglas
     * sin calibrar, así que deja `null` en lugar de inventar un porcentaje.
     */
    confidence: number | null;
    autoClassified: boolean;
    engine: 'fastapi_vision' | 'sharp_studio_pipeline';
    enhancementApplied: string[];
    originalDimensions?: { width: number; height: number };
    method?: string;
    /** El tipo se decidió con poca seguridad: conviene que la usuaria lo confirme */
    lowConfidence?: boolean;
    modelVersion?: string;
    pattern?: string | null;
    style?: string | null;
    styles?: string[];
    suggestedOccasion?: string | null;
    alternatives?: { subcategory: string; probability: number }[];
    colors?: { name: string; hex: string; share: number }[];
    /** Vector visual de 512 dimensiones (ResNet-34): detecta la misma prenda registrada dos veces */
    embedding?: number[];
  };
}

interface ColorEntry {
  name: string;
  hex: string;
  rgb: [number, number, number];
}

const COLOR_PALETTE: ColorEntry[] = [
  { name: 'Negro', hex: '#18181B', rgb: [24, 24, 27] },
  { name: 'Blanco Perla', hex: '#F8FAFC', rgb: [248, 250, 252] },
  { name: 'Gris Marengo', hex: '#64748B', rgb: [100, 116, 139] },
  { name: 'Beige Arena', hex: '#D6C7B2', rgb: [214, 199, 178] },
  { name: 'Azul Marino', hex: '#1E3A8A', rgb: [30, 58, 138] },
  { name: 'Azul Celeste', hex: '#38BDF8', rgb: [56, 189, 248] },
  { name: 'Rojo Vino', hex: '#991B1B', rgb: [153, 27, 27] },
  { name: 'Rosa Pastel', hex: '#F472B6', rgb: [244, 114, 182] },
  { name: 'Verde Esmeralda', hex: '#059669', rgb: [5, 150, 105] },
  { name: 'Verde Oliva', hex: '#4D7C0F', rgb: [77, 124, 15] },
  { name: 'Amarillo Mostaza', hex: '#CA8A04', rgb: [202, 138, 4] },
  { name: 'Naranja Terracota', hex: '#C2410C', rgb: [194, 65, 12] },
  { name: 'Morado Lavanda', hex: '#7C3AED', rgb: [124, 58, 237] },
  { name: 'Café Camel', hex: '#78350F', rgb: [120, 53, 15] },
];

@Injectable()
export class WardrobeEnhancementService {
  private readonly wardrobeUploadDir = path.join(process.cwd(), 'uploads', 'wardrobe');

  constructor(@Optional() private readonly ai?: AiGatewayService) {
    if (!fs.existsSync(this.wardrobeUploadDir)) {
      fs.mkdirSync(this.wardrobeUploadDir, { recursive: true });
    }
  }

  /**
   * Valida los Magic Bytes del archivo para asegurar que provenga realmente de una
   * imagen válida capturada por la cámara o seleccionada de la galería móvil.
   */
  validateImageMagicBytes(buffer: Buffer): { valid: boolean; format?: string } {
    if (!buffer || buffer.length < 12) {
      return { valid: false };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, format: 'jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { valid: true, format: 'png' };
    }

    // WEBP: "RIFF" .... "WEBP"
    if (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { valid: true, format: 'webp' };
    }

    return { valid: false };
  }

  /**
   * Procesa la fotografía de una prenda:
   * 1. Valida Magic Bytes y tamaño máximo (8MB para cámaras móviles).
   * 2. Limpia metadatos EXIF/GPS para proteger la privacidad de la usuaria.
   * 3. Genera la versión original optimizada y la imagen mejorada realista tipo estudio/catálogo.
   * 4. Detecta categoría, subcategoría (blusas, camisas, vestidos, pantalones...), color, talla aprox. y temporada.
   */
  async processAndEnhanceGarment(
    file: Express.Multer.File,
    hints?: { name?: string; subcategory?: WardrobeSubcategory; category?: WardrobeCategory },
  ): Promise<GarmentEnhancementResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'La fotografía de la prenda es obligatoria (cámara o galería).',
      );
    }

    const MAX_SIZE = 8 * 1024 * 1024; // 8MB para fotos de cámara móvil
    if (file.buffer.length > MAX_SIZE) {
      throw new BadRequestException(
        'La fotografía excede el tamaño máximo permitido de 8MB.',
      );
    }

    const magic = this.validateImageMagicBytes(file.buffer);
    if (!magic.valid) {
      throw new BadRequestException(
        'El archivo enviado no es una imagen válida. Se admiten formatos JPEG, PNG o WEBP.',
      );
    }

    const fileHash = crypto.randomBytes(16).toString('hex');
    const origFilename = `orig_${fileHash}.webp`;
    const enhancedFilename = `enhanced_${fileHash}.webp`;
    const origPath = path.join(this.wardrobeUploadDir, origFilename);
    const enhancedPath = path.join(this.wardrobeUploadDir, enhancedFilename);

    // Obtener dimensiones y estadísticas cromáticas con Sharp
    const image = sharp(file.buffer).rotate(); // Corrige orientación EXIF móvil y limpia metadatos
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 1000;

    // Guardar imagen original limpia de EXIF y optimizada en WebP
    const origBuffer = await sharp(file.buffer)
      .rotate()
      .resize(1000, 1250, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    await fs.promises.writeFile(origPath, origBuffer);

    // Intentar usar el microservicio FastAPI de Visión si está configurado y activo;
    // de lo contrario, ejecutar el pipeline local de estudio realista con Sharp.
    const fastApiResult = await this.tryFastApiGarmentAnalysis(file, hints?.name);

    if (fastApiResult) {
      const enhancedBufferFromAi = await sharp(
        Buffer.from(fastApiResult.enhanced_image_base64, 'base64'),
      )
        .webp({ quality: 90 })
        .toBuffer();
      await fs.promises.writeFile(enhancedPath, enhancedBufferFromAi);

      const subcat = hints?.subcategory || (fastApiResult.subcategory as WardrobeSubcategory);
      const cat = hints?.category || SUBCATEGORY_TO_CATEGORY[subcat] || (fastApiResult.category as WardrobeCategory);

      return {
        originalImageUrl: `/uploads/wardrobe/${origFilename}`,
        enhancedImageUrl: `/uploads/wardrobe/${enhancedFilename}`,
        category: cat,
        subcategory: subcat,
        color: fastApiResult.color,
        colorHex: fastApiResult.color_hex,
        approximateSize: fastApiResult.approximate_size,
        season: fastApiResult.season as WardrobeSeason,
        aiMetadata: {
          confidence: fastApiResult.confidence,
          autoClassified: true,
          engine: 'fastapi_vision',
          enhancementApplied: fastApiResult.enhancement_applied,
          originalDimensions: { width, height },
          method: fastApiResult.method,
          lowConfidence: fastApiResult.lowConfidence ?? fastApiResult.confidence === null,
          modelVersion: fastApiResult.model_version,
          pattern: fastApiResult.pattern ?? null,
          style: fastApiResult.style ?? null,
          styles: fastApiResult.styles ?? [],
          suggestedOccasion: fastApiResult.occasion ?? null,
          alternatives: fastApiResult.alternatives ?? [],
          colors: fastApiResult.colors ?? [],
          embedding: Array.isArray(fastApiResult.feature_vector) ? fastApiResult.feature_vector : undefined,
        },
      };
    }

    // Pipeline local de estudio realista con Sharp:
    // Recorta bordes ruidosos, normaliza iluminación/contraste, aplica nitidez textil
    // y centra la prenda sobre un lienzo limpio de estudio (800x1000, 4:5).
    const foregroundGarment = await sharp(file.buffer)
      .rotate()
      .normalise()
      .modulate({ brightness: 1.03, saturation: 1.06 })
      .sharpen({ sigma: 0.9 })
      .resize(680, 860, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .webp({ quality: 92 })
      .toBuffer();

    const studioCanvasBuffer = await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 4,
        background: { r: 248, g: 250, b: 252, alpha: 1 },
      },
    })
      .composite([{ input: foregroundGarment, gravity: 'center' }])
      .webp({ quality: 90 })
      .toBuffer();

    await fs.promises.writeFile(enhancedPath, studioCanvasBuffer);

    // Extraer el color dominante del centro de la prenda (ignorando los márgenes del fondo)
    const stats = await sharp(foregroundGarment).stats();
    const r = Math.round(stats.channels[0]?.mean ?? 120);
    const g = Math.round(stats.channels[1]?.mean ?? 120);
    const b = Math.round(stats.channels[2]?.mean ?? 120);
    const matchedColor = this.matchClosestColor([r, g, b]);

    const hintText = `${hints?.name || ''} ${file.originalname || ''}`.trim();
    const detectedSubcategory =
      hints?.subcategory || this.classifySubcategory(width, height, [r, g, b], hintText);
    const detectedCategory =
      hints?.category || SUBCATEGORY_TO_CATEGORY[detectedSubcategory];
    const approximateSize = this.estimateApproximateSize(width, height);
    const season = this.inferSeason(detectedSubcategory);

    return {
      originalImageUrl: `/uploads/wardrobe/${origFilename}`,
      enhancedImageUrl: `/uploads/wardrobe/${enhancedFilename}`,
      category: detectedCategory,
      subcategory: detectedSubcategory,
      color: matchedColor.name,
      colorHex: matchedColor.hex,
      approximateSize,
      season,
      aiMetadata: {
        confidence: null,
        autoClassified: !hints?.category && !hints?.subcategory,
        engine: 'sharp_studio_pipeline',
        enhancementApplied: [
          'exif_privacy_strip',
          'studio_lighting_normalize',
          'textile_sharpen',
          'catalog_canvas_4x5',
        ],
        originalDimensions: { width, height },
      },
    };
  }

  /**
   * Elimina del disco las imágenes asociadas a una prenda cuando la usuaria la borra.
   */
  async removeGarmentImages(urls: Array<string | null | undefined>): Promise<void> {
    for (const url of urls) {
      if (!url || !url.startsWith('/uploads/wardrobe/')) continue;
      const filename = path.basename(url);
      const filePath = path.join(this.wardrobeUploadDir, filename);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {
        // Ignorar si el archivo ya fue eliminado previamente
      }
    }
  }

  private matchClosestColor(rgb: [number, number, number]): { name: string; hex: string } {
    let best = COLOR_PALETTE[0];
    let minDistance = Number.POSITIVE_INFINITY;

    for (const entry of COLOR_PALETTE) {
      const dist =
        (rgb[0] - entry.rgb[0]) ** 2 +
        (rgb[1] - entry.rgb[1]) ** 2 +
        (rgb[2] - entry.rgb[2]) ** 2;
      if (dist < minDistance) {
        minDistance = dist;
        best = entry;
      }
    }

    return { name: best.name, hex: best.hex };
  }

  private classifySubcategory(
    width: number,
    height: number,
    rgb: [number, number, number],
    hintText: string,
  ): WardrobeSubcategory {
    const normalized = hintText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const keywordRules: Array<[string, WardrobeSubcategory]> = [
      ['blusa', 'blusas'],
      ['camisa', 'camisas'],
      ['camiseta', 'camisetas'],
      ['polera', 'camisetas'],
      ['remera', 'camisetas'],
      ['top', 'tops'],
      ['vestido', 'vestidos'],
      ['pantalon', 'pantalones'],
      ['jean', 'jeans'],
      ['vaquero', 'jeans'],
      ['falda', 'faldas'],
      ['pollera', 'faldas'],
      ['short', 'shorts'],
      ['bermuda', 'shorts'],
      ['chaqueta', 'chaquetas'],
      ['chamarra', 'chaquetas'],
      ['abrigo', 'abrigos'],
      ['gabardina', 'abrigos'],
      ['sueter', 'sueteres'],
      ['chompa', 'sueteres'],
      ['cardigan', 'sueteres'],
      ['blazer', 'blazers'],
      ['saco', 'blazers'],
      ['zapatilla', 'zapatillas'],
      ['tenis', 'zapatillas'],
      ['sneaker', 'zapatillas'],
      ['tacon', 'tacones'],
      ['zapato', 'tacones'],
      ['bota', 'botas'],
      ['botin', 'botas'],
      ['sandalia', 'sandalias'],
    ];

    for (const [keyword, subcategory] of keywordRules) {
      if (normalized.includes(keyword)) {
        return subcategory;
      }
    }

    const aspectRatio = height / Math.max(width, 1);
    if (aspectRatio <= 0.75) {
      return 'zapatillas';
    }
    if (aspectRatio >= 1.35) {
      return 'pantalones';
    }
    if (aspectRatio >= 1.10) {
      return 'camisas';
    }
    const avgBrightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
    if (avgBrightness < 80) {
      return 'chaquetas';
    }
    return 'camisetas';
  }

  private estimateApproximateSize(width: number, height: number): string {
    const ratio = width / Math.max(height, 1);
    if (ratio < 0.62) return 'S (Aprox.)';
    if (ratio < 0.85) return 'M (Aprox.)';
    if (ratio < 1.05) return 'L (Aprox.)';
    return 'M (Aprox.)';
  }

  private inferSeason(subcategory: WardrobeSubcategory): WardrobeSeason {
    if (['abrigos', 'chaquetas', 'sueteres', 'botas'].includes(subcategory)) {
      return 'invierno';
    }
    if (['shorts', 'sandalias', 'tops'].includes(subcategory)) {
      return 'verano';
    }
    if (['vestidos', 'blusas', 'faldas'].includes(subcategory)) {
      return 'primavera';
    }
    return 'todo_el_ano';
  }

  /**
   * Analiza la foto de una prenda con el servicio de IA (tipo, color, estampado, estilo y vector
   * visual) sin guardarla. Devuelve null si el servicio no está disponible.
   */
  analyzePhoto(file: Express.Multer.File) {
    return this.tryFastApiGarmentAnalysis(file);
  }

  private async tryFastApiGarmentAnalysis(
    file: Express.Multer.File,
    nameHint?: string,
  ): Promise<{
    category: string;
    subcategory: string;
    color: string;
    color_hex: string;
    approximate_size: string;
    season: string;
    /** Probabilidad del modelo que decidió el tipo; null si ningún modelo reconoció la prenda */
    confidence: number | null;
    lowConfidence?: boolean;
    enhanced_image_base64: string;
    enhancement_applied: string[];
    method?: string;
    model_version?: string;
    pattern?: string;
    style?: string | null;
    styles?: string[];
    occasion?: string | null;
    alternatives?: { subcategory: string; probability: number }[];
    colors?: { name: string; hex: string; share: number }[];
    feature_vector?: number[];
  } | null> {
    // HU-043: la comunicación con la IA pasa por el gateway (URL, clave interna y tiempos)
    if (!this.ai || !process.env.AI_SERVICE_URL) return null;
    try {
      if (this.ai) {
        return await this.ai.postImage(
          '/api/v1/vision/analyze-garment',
          { buffer: file.buffer, mimetype: file.mimetype, originalname: nameHint || file.originalname || 'garment.jpg' },
          {},
          15_000,
        );
      }

      const aiServiceUrl = process.env.AI_SERVICE_URL;
      if (!aiServiceUrl) return null;

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'image/jpeg',
      });
      formData.append('file', blob, nameHint || file.originalname || 'garment.jpg');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/api/v1/vision/analyze-garment`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return null;
      return (await response.json()) as any;
    } catch {
      return null;
    }
  }
}
