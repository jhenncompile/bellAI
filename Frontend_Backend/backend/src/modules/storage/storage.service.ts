import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadFileOptions {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  s3Url: string;
  cdnUrl: string;
  bucket: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private cdnBaseUrl: string;
  /** true solo si hay una CDN real delante (CDN_BASE_URL); MinIO o el disco local no cuentan. */
  private cdnConfigured = false;
  private useS3: boolean;
  private readonly localFallbackDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'bellia-media');
    this.region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.endpoint = this.configService.get<string>('S3_ENDPOINT') || undefined;

    // Base URL de la CDN (CloudFront en producción o MinIO/Local en desarrollo)
    const rawCdnUrl = this.configService.get<string>('CDN_BASE_URL');
    if (rawCdnUrl) {
      this.cdnBaseUrl = rawCdnUrl.replace(/\/$/, '');
      this.cdnConfigured = true;
    } else if (this.endpoint) {
      this.cdnBaseUrl = `${this.endpoint.replace(/\/$/, '')}/${this.bucket}`;
    } else {
      const port = this.configService.get<string>('PORT', '8000');
      this.cdnBaseUrl = `http://localhost:${port}/uploads`;
    }

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    // Determinar si inicializamos el cliente S3
    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        forcePathStyle: forcePathStyle, // Necesario para MinIO / Localstack
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.useS3 = true;
      this.logger.log(`Inicializado cliente S3 en región: ${this.region}, endpoint: ${this.endpoint || 'AWS S3 Estándar'}`);
    } else {
      this.useS3 = false;
      this.logger.warn('Credenciales S3 no encontradas. Operando en modo almacenamiento local con CDN simulado.');
      if (!fs.existsSync(this.localFallbackDir)) {
        fs.mkdirSync(this.localFallbackDir, { recursive: true });
      }
    }
  }

  async onModuleInit() {
    if (this.useS3 && this.s3Client) {
      await this.ensureBucketAndCors();
    }
  }

  /** Error de red (MinIO/S3 apagado o inalcanzable): no hubo respuesta HTTP del servidor. */
  /** Si de verdad se está usando S3 ahora (si no responde, se pasa a disco aunque haya credenciales). */
  get usingS3(): boolean {
    return Boolean(this.useS3 && this.s3Client);
  }

  private static isNetworkError(err: any): boolean {
    if (err?.$metadata?.httpStatusCode) return false;
    const codes = [err?.code, ...(err?.errors ?? []).map((e: any) => e?.code)];
    return (
      err?.name === 'AggregateError' ||
      codes.some((c) => ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNRESET'].includes(c))
    );
  }

  /**
   * Si el almacenamiento de objetos no responde al arrancar, se usa la carpeta local uploads/
   * (igual que sin credenciales) en vez de fallar cada subida con un AggregateError sin explicación.
   */
  private fallBackToLocal(reason: string) {
    this.useS3 = false;
    this.s3Client = null;
    // Una CDN que apunta al propio MinIO (p. ej. http://localhost:9000/bucket) tampoco responde
    const cdn = this.configService.get<string>('CDN_BASE_URL');
    const s3Host = this.endpoint?.replace(/\/$/, '');
    if (!cdn || (s3Host && cdn.startsWith(s3Host))) {
      this.cdnBaseUrl = `http://localhost:${this.configService.get<string>('PORT', '8000')}/uploads`;
      this.cdnConfigured = false;
    }
    if (!fs.existsSync(this.localFallbackDir)) {
      fs.mkdirSync(this.localFallbackDir, { recursive: true });
    }
    this.logger.warn(
      `No se pudo conectar con el almacenamiento S3 en ${this.endpoint || 'AWS'} (${reason}). ` +
        'Se usará almacenamiento local en uploads/. Inicia MinIO (docker compose up -d minio) y reinicia para usar S3.',
    );
  }

  /** Envía un comando a S3 y traduce la caída del servicio a un 503 comprensible. */
  private async s3Send<T = any>(command: any): Promise<T> {
    try {
      return (await (this.s3Client as S3Client).send(command)) as T;
    } catch (err: any) {
      if (StorageService.isNetworkError(err)) {
        this.logger.error(`Almacenamiento S3 inalcanzable en ${this.endpoint || 'AWS'}: ${err?.message || err?.name}`);
        throw new ServiceUnavailableException(
          'El almacenamiento de archivos no está disponible en este momento. Inténtalo más tarde.',
        );
      }
      throw err;
    }
  }

  /**
   * Garantiza que el bucket exista y configure CORS permisivo para visualización 3D (WebGL / Three.js)
   */
  private async ensureBucketAndCors() {
    if (!this.s3Client) return;

    try {
      // 1. Verificar si el bucket existe
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket S3 "${this.bucket}" confirmado y listo.`);
      } catch (err: any) {
        if (StorageService.isNetworkError(err)) {
          this.fallBackToLocal(err?.code || err?.errors?.[0]?.code || err?.name || 'sin respuesta');
          return;
        }
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          this.logger.log(`Creando bucket S3: ${this.bucket}...`);
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        }
      }

      // 2. Configurar CORS para permitir que Three.js y WebGL carguen modelos 3D y texturas cross-origin
      try {
        await this.s3Client.send(
          new PutBucketCorsCommand({
            Bucket: this.bucket,
            CORSConfiguration: {
              CORSRules: [
                {
                  AllowedHeaders: ['*'],
                  AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST'],
                  AllowedOrigins: ['*'],
                  ExposeHeaders: ['ETag', 'Content-Type', 'Content-Length'],
                  MaxAgeSeconds: 86400,
                },
              ],
            },
          }),
        );
        this.logger.log(`Reglas CORS configuradas para modelos 3D y texturas en bucket "${this.bucket}".`);
      } catch (corsErr: any) {
        this.logger.debug(`Nota sobre configuración CORS: ${corsErr.message}`);
      }
    } catch (error: any) {
      this.logger.warn(`No se pudo autoverificar el bucket S3 (puede deberse a permisos restringidos de IAM): ${error.message}`);
    }
  }

  /**
   * Sube un archivo a S3 / Object Storage y genera la URL CDN acelerada
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
    const { key, buffer, contentType, cacheControl, metadata } = options;
    const sanitizedKey = key.replace(/^\/+/, '');

    // Default Cache-Control: Cache inmutable de 1 año para activos optimizados con CDN
    const finalCacheControl = cacheControl || 'public, max-age=31536000, immutable';

    if (this.useS3 && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: finalCacheControl,
        Metadata: metadata || {},
      });

      await this.s3Send(command);

      const s3Url = this.endpoint
        ? `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${sanitizedKey}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${sanitizedKey}`;

      const cdnUrl = `${this.cdnBaseUrl}/${sanitizedKey}`;

      return {
        key: sanitizedKey,
        s3Url,
        cdnUrl,
        bucket: this.bucket,
      };
    } else {
      // Fallback local filesystem
      const localFilePath = path.join(this.localFallbackDir, sanitizedKey);
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(localFilePath, buffer);

      const localUrl = `/uploads/${sanitizedKey}`;
      const cdnUrl = `${this.cdnBaseUrl}/${sanitizedKey}`;

      return {
        key: sanitizedKey,
        s3Url: localUrl,
        cdnUrl,
        bucket: 'local-filesystem',
      };
    }
  }

  /**
   * Genera una URL prefirmada de subida directa (Direct-to-S3 Upload)
   * Ideal para modelos 3D de 50MB-100MB y texturas 4K/8K para evitar colapsar la memoria del backend.
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = 900,
  ): Promise<{ uploadUrl: string; key: string; cdnUrl: string; s3Url: string }> {
    const sanitizedKey = key.replace(/^\/+/, '');
    const cdnUrl = `${this.cdnBaseUrl}/${sanitizedKey}`;

    if (this.useS3 && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      const s3Url = this.endpoint
        ? `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${sanitizedKey}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${sanitizedKey}`;

      return {
        uploadUrl,
        key: sanitizedKey,
        cdnUrl,
        s3Url,
      };
    } else {
      // Fallback para desarrollo sin S3: endpoint local simulado
      const simulatedUrl = `/api/media/direct-upload-simulated?key=${encodeURIComponent(sanitizedKey)}`;
      return {
        uploadUrl: simulatedUrl,
        key: sanitizedKey,
        cdnUrl,
        s3Url: `/uploads/${sanitizedKey}`,
      };
    }
  }

  /**
   * Genera URL prefirmada de descarga privada (para activos con acceso restringido)
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    const sanitizedKey = key.replace(/^\/+/, '');

    if (this.useS3 && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    }

    return `${this.cdnBaseUrl}/${sanitizedKey}`;
  }

  /**
   * Elimina un archivo de S3 / Almacenamiento
   */
  async deleteFile(key: string): Promise<void> {
    const sanitizedKey = key.replace(/^\/+/, '');

    if (this.useS3 && this.s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: sanitizedKey,
      });
      await this.s3Send(command);
    } else {
      const localFilePath = path.join(this.localFallbackDir, sanitizedKey);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath).catch(() => null);
      }
    }
  }

  /**
   * Lee un archivo completo (usado por los workers de IA para procesar fotos privadas).
   */
  async readFile(key: string): Promise<Buffer> {
    const sanitizedKey = key.replace(/^\/+/, '');
    if (sanitizedKey.split('/').includes('..')) throw new Error('Clave de archivo no válida');
    if (this.useS3 && this.s3Client) {
      const res = await this.s3Send(new GetObjectCommand({ Bucket: this.bucket, Key: sanitizedKey }));
      const bytes = await (res.Body as any).transformToByteArray();
      return Buffer.from(bytes);
    }
    return fs.promises.readFile(path.join(this.localFallbackDir, sanitizedKey));
  }

  /**
   * Retorna la URL CDN optimizada de un activo dada su clave
   */
  getCdnUrl(key: string): string {
    const sanitizedKey = key.replace(/^\/+/, '');
    return `${this.cdnBaseUrl}/${sanitizedKey}`;
  }

  /**
   * Retorna el estado y configuración del servicio de almacenamiento y CDN
   */
  getStatus() {
    return {
      provider: this.useS3 ? 'AWS S3 / Compatible Object Storage' : 'Local Simulated Storage',
      bucket: this.bucket,
      region: this.region,
      endpoint: this.endpoint || 'AWS S3 Default',
      cdnBaseUrl: this.cdnBaseUrl,
      active: true,
      usesS3: this.useS3,
      // Antes eran `true` fijos: la caché en el borde solo existe con S3 y una CDN configurada
      edgeCachingEnabled: this.useS3 && this.cdnConfigured,
    };
  }
}
