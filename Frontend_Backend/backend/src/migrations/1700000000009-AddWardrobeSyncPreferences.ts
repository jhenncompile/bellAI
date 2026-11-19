import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWardrobeSyncPreferences1700000000009 implements MigrationInterface {
  name = 'AddWardrobeSyncPreferences1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE preferences
        ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS offline_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE preferences
        DROP COLUMN IF EXISTS last_synced_at,
        DROP COLUMN IF EXISTS offline_mode_enabled,
        DROP COLUMN IF EXISTS auto_backup_enabled;
    `);
  }
}
