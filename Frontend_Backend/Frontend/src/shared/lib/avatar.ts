import { apiClient } from './axios';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

/** Origen del servidor de la API (sin `/api`), sacado de `VITE_API_URL`. Vacío si la API va por el mismo origen. */
function apiOrigin(): string {
  const base = apiClient.defaults.baseURL || '';
  try {
    return /^https?:\/\//.test(base) ? new URL(base).origin : '';
  } catch {
    return '';
  }
}

/**
 * Convierte la URL de un archivo del servidor en una que funcione desde este navegador:
 * las relativas (`/uploads/...`) se resuelven contra la API, y las guardadas con `localhost`
 * se reescriben, porque desde otro equipo de la red `localhost` es ese equipo y no el servidor.
 */
export function resolveMediaUrl(url: string): string {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const origin = apiOrigin();
  if (url.startsWith('/')) return `${origin}${url}`;
  try {
    const parsed = new URL(url);
    if (origin && LOCAL_HOSTS.includes(parsed.hostname)) return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // no es una URL absoluta: se deja tal cual
  }
  return url;
}

/**
 * Devuelve la URL del avatar del usuario, con un fallback generado a partir
 * de una semilla (normalmente el correo o el nombre) cuando no hay imagen.
 */
export function getAvatarUrl(seed: string, url?: string | null): string {
  if (url) return resolveMediaUrl(url);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'user')}`;
}
