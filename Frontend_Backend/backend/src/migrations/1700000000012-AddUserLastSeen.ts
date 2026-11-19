import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HU-30: última actividad de cada cuenta, para contar en el panel las usuarias activas de verdad
 * (con actividad reciente) y no solo las cuentas habilitadas.
 * - Se actualiza al iniciar sesión y, como mucho cada 5 minutos, en cada petición autenticada.
 * - Para no empezar de cero, se rellena con la última acción conocida (auditoría y armario).
 * Idempotente: el mismo SQL está en schema.sql.
 */
export const USER_LAST_SEEN_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at);
`;

export const USER_LAST_SEEN_BACKFILL_SQL = `
UPDATE users u SET last_seen_at = a.at
FROM (
  SELECT user_id, MAX(at) AS at FROM (
    SELECT user_id, MAX(created_at) AS at FROM audit_logs WHERE user_id IS NOT NULL GROUP BY user_id
    UNION ALL
    SELECT user_id, MAX(updated_at) AS at FROM wardrobe_items GROUP BY user_id
  ) x GROUP BY user_id
) a
WHERE a.user_id = u.id AND u.last_seen_at IS NULL;
`;

export class AddUserLastSeen1700000000012 implements MigrationInterface {
  name = 'AddUserLastSeen1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(USER_LAST_SEEN_SQL);
    await queryRunner.query(USER_LAST_SEEN_BACKFILL_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_users_last_seen_at');
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS last_seen_at');
  }
}
