/**
 * HU-30: registra la última actividad de una cuenta (`users.last_seen_at`).
 * Para no escribir en la base en cada petición, cada proceso la actualiza como mucho cada
 * `LAST_SEEN_THROTTLE_MS` por cuenta. Es un SQL directo para no tocar `updated_at`.
 */
export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

const lastWrite = new Map<string, number>();

/** Decide si toca escribir (y lo anota). Exportada para probarla sin base de datos. */
export function shouldTouch(userId: string, now = Date.now(), force = false): boolean {
  const prev = lastWrite.get(userId);
  if (!force && prev !== undefined && now - prev < LAST_SEEN_THROTTLE_MS) return false;
  lastWrite.set(userId, now);
  // Evita que el mapa crezca sin límite en procesos de larga duración
  if (lastWrite.size > 10_000) lastWrite.clear();
  return true;
}

export async function touchLastSeen(query: (sql: string, params: unknown[]) => Promise<unknown>, userId: string, force = false) {
  if (!shouldTouch(userId, Date.now(), force)) return;
  try {
    await query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
  } catch {
    // La actividad es informativa: nunca debe romper la petición
  }
}
