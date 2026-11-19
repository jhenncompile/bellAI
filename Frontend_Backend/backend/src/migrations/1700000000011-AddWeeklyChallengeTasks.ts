import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HU-28: retos semanales generados por el servidor.
 * - Cada tarea lleva una descripción y la pantalla de la app donde se hace (`accion`).
 * - Un solo reto por semana: el índice único sobre `inicio` evita duplicados al generarlo.
 * Idempotente: el mismo SQL está en schema.sql.
 */
export const WEEKLY_CHALLENGE_SQL = `
ALTER TABLE reto_tarea ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE reto_tarea ADD COLUMN IF NOT EXISTS accion VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reto_semanal_inicio ON reto_semanal (inicio);
`;

export class AddWeeklyChallengeTasks1700000000011 implements MigrationInterface {
  name = 'AddWeeklyChallengeTasks1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(WEEKLY_CHALLENGE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ux_reto_semanal_inicio');
    await queryRunner.query('ALTER TABLE reto_tarea DROP COLUMN IF EXISTS accion');
    await queryRunner.query('ALTER TABLE reto_tarea DROP COLUMN IF EXISTS descripcion');
  }
}
