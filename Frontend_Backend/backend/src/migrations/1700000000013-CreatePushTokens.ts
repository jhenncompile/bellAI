import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notificaciones push (HU-12 / HU-20): tokens de Expo de cada teléfono, para avisar a la usuaria
 * cuando su análisis termina aunque haya salido de la app.
 * - El token es la clave: un teléfono pertenece a la última cuenta que lo registró
 *   (si otra persona inicia sesión en el mismo teléfono, el token pasa a su cuenta).
 * - Se borra en cascada con la cuenta y al cerrar sesión.
 * - Si la usuaria desactiva las notificaciones (`preferences.push_notifications`), no se envía nada.
 * Idempotente: el mismo SQL está en schema.sql.
 */
export const PUSH_TOKENS_SQL = `
CREATE TABLE IF NOT EXISTS push_token (
    token VARCHAR(255) PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plataforma VARCHAR(10) NOT NULL DEFAULT 'android' CHECK (plataforma IN ('android', 'ios')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_push_token_usuario ON push_token (usuario_id);
`;

export class CreatePushTokens1700000000013 implements MigrationInterface {
  name = 'CreatePushTokens1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(PUSH_TOKENS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS push_token');
  }
}
