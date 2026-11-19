import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as crypto from 'crypto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UploadService {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Valida los Magic Bytes del buffer de imagen para prevenir ataques de archivo malicioso disfrazado.
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

    // GIF: "GIF87a" o "GIF89a"
    if (
      buffer.toString('ascii', 0, 6) === 'GIF87a' ||
      buffer.toString('ascii', 0, 6) === 'GIF89a'
    ) {
      return { valid: true, format: 'gif' };
    }

    return { valid: false };
  }

  /**
   * Pre-procesa la imagen de avatar:
   * 1. Valida magic bytes.
   * 2. Elimina metadatos EXIF (evita fuga de geolocalización GPS).
   * 3. Redimensiona a 400x400 centrado.
   * 4. Convierte a formato ultra-eficiente WebP con compresión de alta calidad.
   * 5. Sube a S3 / Object Storage y retorna la URL optimizada servida por CDN.
   */
  async processAndSaveAvatar(file: Express.Multer.File): Promise<{ url: string; size: number }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No se ha proporcionado ningún archivo de imagen');
    }

    // 1. Límite de tamaño: máx 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.buffer.length > MAX_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo permitido de 5MB');
    }

    // 2. Validación estricta por Magic Bytes
    const magicCheck = this.validateImageMagicBytes(file.buffer);
    if (!magicCheck.valid) {
      throw new BadRequestException(
        'El archivo no es una imagen válida o tiene un formato no soportado (sólo JPEG, PNG, WEBP)',
      );
    }

    // 3. Generar nombre de archivo único con hash criptográfico
    const fileHash = crypto.randomBytes(16).toString('hex');
    const s3Key = `avatars/avatar_${fileHash}.webp`;

    // 4. Preprocesar con Sharp: auto-orientación, recorte 400x400, limpieza EXIF y conversión WebP
    const processedBuffer = await sharp(file.buffer)
      .rotate()
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    // 5. Subir a S3 / Object Storage con directiva inmutable para aceleración CDN
    const uploadResult = await this.storageService.uploadFile({
      key: s3Key,
      buffer: processedBuffer,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        type: 'avatar',
      },
    });

    return {
      url: uploadResult.cdnUrl,
      size: processedBuffer.length,
    };
  }

  async deleteAvatar(url?: string | null): Promise<void> {
    if (!url) return;
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      pathname = url.split(/[?#]/, 1)[0];
    }

    const markerIndex = pathname.indexOf('/avatars/');
    if (markerIndex < 0) return;
    const key = pathname.slice(markerIndex + 1);
    if (!/^avatars\/avatar_[a-f0-9]{32}\.webp$/i.test(key)) return;
    await this.storageService.deleteFile(key);
  }
}
