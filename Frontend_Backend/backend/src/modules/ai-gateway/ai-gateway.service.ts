import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

/**
 * HU-043: único punto de comunicación con el servicio de IA (FastAPI).
 * Centraliza URL, clave interna, tiempos de espera y traducción de errores, de modo que
 * sustituir un modelo o el propio servicio no afecte al resto de módulos.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('AI_SERVICE_URL') || 'http://localhost:8001').replace(/\/$/, '');
    this.internalKey = config.get<string>('AI_INTERNAL_KEY') || '';
  }

  get url() {
    return this.baseUrl;
  }

  private headers(extra: Record<string, string> = {}) {
    return this.internalKey ? { 'X-Internal-Key': this.internalKey, ...extra } : extra;
  }

  private async request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch (err: any) {
      this.logger.warn(`Servicio de IA no disponible (${path}): ${err?.message}`);
      throw new ServiceUnavailableException(
        err?.name === 'AbortError'
          ? 'El análisis tardó demasiado. Inténtalo de nuevo en unos segundos.'
          : 'El servicio de análisis no está disponible en este momento.',
      );
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { detail: text };
    }
    if (response.ok) return body as T;
    const detail = body?.detail;
    if (response.status === 422) {
      // Foto inválida (HU-035) o análisis fallido: se reenvía el detalle estructurado
      throw new UnprocessableEntityException(
        typeof detail === 'object' ? detail : { code: 'analisis_fallido', message: String(detail || 'No se pudo analizar la foto.') },
      );
    }
    if (response.status === 400 || response.status === 413) {
      throw new HttpException(typeof detail === 'string' ? detail : 'La imagen no es válida.', response.status);
    }
    if (response.status === 503) {
      throw new ServiceUnavailableException('Los modelos de análisis no están cargados en el servidor.');
    }
    this.logger.error(`Error ${response.status} del servicio de IA en ${path}: ${text.slice(0, 300)}`);
    throw new BadGatewayException('El servicio de análisis respondió con un error.');
  }

  /** Envía una imagen en multipart (campo `file`) junto con campos de texto adicionales. */
  async postImage<T = any>(path: string, file: AiFile, fields: Record<string, unknown> = {}, timeoutMs = 60_000, extraFiles: Record<string, AiFile> = {}): Promise<T> {
    return this.postFiles<T>(path, { file, ...extraFiles }, fields, timeoutMs);
  }

  /** Envía varias imágenes en multipart, cada una con su nombre de campo. */
  async postFiles<T = any>(path: string, files: Record<string, AiFile>, fields: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
    const form = new FormData();
    for (const [name, f] of Object.entries(files)) {
      form.append(name, new Blob([new Uint8Array(f.buffer)], { type: f.mimetype || 'image/jpeg' }), f.originalname || `${name}.jpg`);
    }
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    return this.request<T>(path, { method: 'POST', body: form, headers: this.headers() }, timeoutMs);
  }

  async postJson<T = any>(path: string, payload: unknown, timeoutMs = 30_000): Promise<T> {
    return this.request<T>(
      path,
      { method: 'POST', body: JSON.stringify(payload), headers: this.headers({ 'Content-Type': 'application/json' }) },
      timeoutMs,
    );
  }

  async get<T = any>(path: string, timeoutMs = 10_000): Promise<T> {
    return this.request<T>(path, { method: 'GET', headers: this.headers() }, timeoutMs);
  }

  async health(): Promise<{ ok: boolean; detail?: any }> {
    try {
      const detail = await this.request<any>('/health', { method: 'GET' }, 3_000);
      return { ok: true, detail };
    } catch (err: any) {
      return { ok: false, detail: err?.message };
    }
  }
}
