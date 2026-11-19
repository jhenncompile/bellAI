import { Platform } from 'react-native';

export type AiExecutionMode = 'local' | 'remote' | 'auto';

/**
 * Normaliza cualquier entrada de host, IP:puerto o dominio a una URL HTTP/HTTPS válida:
 * - "192.168.0.32:8000"         -> "http://192.168.0.32:8000"
 * - "127.0.0.1:8000"            -> "http://127.0.0.1:8000"
 * - "api.bellai.beauty"         -> "https://api.bellai.beauty"
 * - "servidor.com:8000"         -> "http://servidor.com:8000"
 * - "http://192.168.0.32:8000"  -> "http://192.168.0.32:8000"
 * - "api: 192.168.0.32:8000"    -> "http://192.168.0.32:8000"
 */
export function normalizeApiUrl(rawInput?: string | null): string | null {
  if (!rawInput || !rawInput.trim()) return null;

  let cleaned = rawInput.trim();

  // Limpiar posibles prefijos como "api:" o "api=" si el usuario lo copió directamente del .env
  cleaned = cleaned.replace(/^api\s*[:=]\s*/i, '');
  // Quitar barra final y sufijo redundante /api si viniera incluido
  cleaned = cleaned.replace(/\/+$/, '').replace(/\/api$/, '');

  if (!cleaned) return null;

  // Si ya tiene protocolo explícito http o https, preservarlo
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  // Detectar si es una dirección IP (v4) o localhost con o sin puerto
  const isIpOrLocal = /^(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|localhost)(?::\d+)?$/i.test(cleaned);
  if (isIpOrLocal) {
    return `http://${cleaned}`;
  }

  // Si contiene dos puntos y un puerto numérico explícito (ej: mi-dominio.com:8000), usar http
  if (/:\d+$/.test(cleaned)) {
    return `http://${cleaned}`;
  }

  // Dominio público estándar (ej: api.bellai.beauty) -> usar https seguro
  return `https://${cleaned}`;
}

/**
 * Determina el modo de ejecución de la IA:
 * - 'local'  -> Ejecuta la IA directamente en el teléfono (Recomendado / Predeterminado). Cero latencia, 100% offline.
 * - 'remote' -> Obliga a enviar la petición al servidor backend configurado en .env.
 * - 'auto'   -> Intenta el backend una sola vez con timeout rápido (1.5s). Si falla, pasa a IA local sin demoras.
 */
function resolveAiMode(): AiExecutionMode {
  const rawMode = (
    process.env.EXPO_PUBLIC_AI_MODE ||
    (process.env as any).AI_MODE ||
    'local'
  ).toLowerCase().trim();

  if (rawMode === 'remote') return 'remote';
  if (rawMode === 'auto') return 'auto';
  return 'local';
}

/**
 * Obtiene la URL de origen configurada en las variables de entorno (.env).
 */
function resolveConfiguredOrigin(): string | null {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API ||
    (process.env as any).API;

  return normalizeApiUrl(fromEnv);
}

let activeOrigin = resolveConfiguredOrigin() || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');
let activeMode = resolveAiMode();

export const ApiConfig = {
  /**
   * Retorna el modo de ejecución de IA ('local' | 'remote' | 'auto')
   */
  getAiMode(): AiExecutionMode {
    return activeMode;
  },

  /**
   * Permite cambiar dinámicamente el modo de IA en tiempo de ejecución
   */
  setAiMode(mode: AiExecutionMode): void {
    activeMode = mode;
  },

  /**
   * Indica si hay una URL de servidor remoto explícitamente configurada en .env
   */
  isRemoteConfigured(): boolean {
    return resolveConfiguredOrigin() !== null;
  },

  /**
   * Origen base del backend (ej: "http://192.168.0.32:8000" o "https://api.bellai.beauty")
   */
  getOrigin(): string {
    return activeOrigin;
  },

  /**
   * Ruta base de la API REST (ej: "http://192.168.0.32:8000/api")
   */
  getBaseUrl(): string {
    return `${this.getOrigin()}/api`;
  },

  /**
   * Permite actualizar dinámicamente el origen en tiempo de ejecución
   */
  setOrigin(newOrigin: string): void {
    const normalized = normalizeApiUrl(newOrigin);
    if (normalized) {
      activeOrigin = normalized;
    }
  },

  /**
   * Retorna la URL del endpoint de análisis facial biométrico
   */
  getFaceEndpoint(): string {
    return `${this.getBaseUrl()}/vision/analyze-face`;
  },

  /**
   * Retorna la URL del endpoint de análisis cromático de prendas
   */
  getGarmentEndpoint(): string {
    return `${this.getBaseUrl()}/vision/analyze-garment`;
  },
};
