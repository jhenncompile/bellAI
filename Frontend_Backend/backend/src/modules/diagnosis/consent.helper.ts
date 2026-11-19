import { DataSource } from 'typeorm';

export const PHOTO_ANALYSIS_CONSENT = 'photo_analysis';
export const PHOTO_RETENTION_CONSENT = 'photo_retention';

/** Último valor registrado de un consentimiento (gdpr_consents es la fuente única de verdad). */
export async function latestConsent(ds: DataSource, userId: string, type: string): Promise<boolean> {
  const [row] = await ds.query(
    `SELECT accepted FROM gdpr_consents WHERE user_id = $1 AND consent_type = $2 ORDER BY created_at DESC LIMIT 1`,
    [userId, type],
  );
  return Boolean(row?.accepted);
}

export async function hasPhotoConsent(ds: DataSource, userId: string): Promise<boolean> {
  if (await latestConsent(ds, userId, PHOTO_ANALYSIS_CONSENT)) return true;
  // Compatibilidad con el consentimiento antiguo de la app móvil
  const [legacy] = await ds.query('SELECT autorizado FROM consentimiento_fotografia WHERE usuario_id = $1', [userId]);
  return Boolean(legacy?.autorizado);
}
