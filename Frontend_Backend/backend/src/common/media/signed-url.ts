import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HU-034 (CP-034-03): las fotos del armario solo son accesibles para su dueña.
 * Las rutas `/uploads/wardrobe/...` se entregan firmadas (HMAC-SHA256 + caducidad) y el
 * servidor rechaza con 403 cualquier petición sin firma válida. Así `<Image uri>` sigue
 * funcionando en la app sin cabeceras de autorización.
 */
const PROTECTED_PREFIX = '/uploads/wardrobe/';
const DEFAULT_TTL_S = 24 * 60 * 60;

function secret(): string {
  return process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || 'bellai-dev-media-secret';
}

function signature(path: string, exp: number): string {
  return createHmac('sha256', secret()).update(`${path}:${exp}`).digest('base64url');
}

/** Firma una ruta relativa protegida. Las URLs absolutas o no protegidas se devuelven igual. */
export function signMediaPath(path: string | null | undefined, ttlSeconds = DEFAULT_TTL_S): string | null {
  if (!path) return path ?? null;
  const clean = path.split('?')[0];
  if (!clean.startsWith(PROTECTED_PREFIX)) return path;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${clean}?exp=${exp}&sig=${signature(clean, exp)}`;
}

export function isProtectedMediaPath(path: string): boolean {
  return path.startsWith(PROTECTED_PREFIX);
}

/** Verifica firma y caducidad de una petición a un recurso protegido. */
export function verifyMediaSignature(path: string, exp: unknown, sig: unknown): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || typeof sig !== 'string' || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signature(path, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
