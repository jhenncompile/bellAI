import { ApiConfig } from './apiConfig';
import { secureToken } from '@/shared/lib/secureToken';
import { sendFormData } from './xhrUpload';
import { notifyPlanLimit } from './planLimit';

/** Error con mensaje listo para mostrar a la usuaria (nunca códigos HTTP ni UUIDs). */
export class FriendlyError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  isNetwork: boolean;

  constructor(message: string, opts: { status?: number; code?: string; details?: unknown; isNetwork?: boolean } = {}) {
    super(message);
    this.name = 'FriendlyError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.isNetwork = Boolean(opts.isNetwork);
  }
}

const GENERIC: Record<number, string> = {
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscabas.',
  413: 'La foto es demasiado grande.',
  429: 'Hiciste muchas solicitudes seguidas. Espera un momento.',
  503: 'El servicio de análisis no está disponible ahora. Inténtalo en unos minutos.',
};

/** Extrae un mensaje legible de cualquier error (axios, fetch o FriendlyError). */
export function friendlyMessage(error: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.'): string {
  if (error instanceof FriendlyError) return error.message;
  const anyErr = error as any;
  const status: number | undefined = anyErr?.response?.status;
  const data = anyErr?.response?.data;
  if (anyErr?.isAxiosError && !anyErr.response) return 'No pudimos conectar con BellAI. Revisa tu conexión.';
  const fromData = messageFromBody(data);
  if (fromData) return fromData;
  if (status && GENERIC[status]) return GENERIC[status];
  return fallback;
}

function messageFromBody(data: any): string | null {
  if (!data) return null;
  const m = data.message ?? data.detail;
  if (typeof m === 'string' && m.trim()) return m;
  if (Array.isArray(m) && m.length) return m.join('. ');
  if (m && typeof m === 'object') {
    if (typeof m.message === 'string') return m.message;
    if (m.quality?.message) return m.quality.message;
  }
  if (data.quality?.message) return data.quality.message;
  return null;
}

export interface UploadFile {
  field: string;
  uri: string;
  name?: string;
  type?: string;
}

/** Envía un multipart con archivos locales (cámara/galería) usando el token seguro. */
export async function uploadMultipart<T>(path: string, files: UploadFile[], fields: Record<string, string | number | undefined> = {}, timeoutMs = 60000): Promise<T> {
  const form = new FormData();
  for (const f of files) {
    const ext = (f.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const type = f.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    form.append(f.field, { uri: f.uri, name: f.name || `foto.${ext === 'png' || ext === 'webp' ? ext : 'jpg'}`, type } as any);
  }
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  const token = await secureToken.get();
  let res: { status: number; text: string };
  try {
    res = await sendFormData('POST', `${ApiConfig.getBaseUrl()}${path}`, form,
      { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, timeoutMs);
  } catch (err: any) {
    if (__DEV__) console.warn('[uploadMultipart]', path, err?.name, err?.message);
    throw new FriendlyError(err?.name === 'AbortError' ? 'La subida tardó demasiado. Inténtalo de nuevo.' : 'No pudimos conectar con BellAI. Revisa tu conexión.', { isNetwork: true });
  }
  let body: any = null;
  try {
    body = res.text ? JSON.parse(res.text) : null;
  } catch {
    body = null;
  }
  const ok = res.status >= 200 && res.status < 300;
  if (!ok) {
    if (res.status === 402) notifyPlanLimit(body);
    throw new FriendlyError(messageFromBody(body) || GENERIC[res.status] || 'No pudimos procesar la foto.', {
      status: res.status,
      code: body?.code ?? body?.message?.code,
      details: body,
    });
  }
  return body as T;
}
