import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStylePreferences1700000000007 implements MigrationInterface {
  name = 'AddStylePreferences1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE preferences
      ADD COLUMN IF NOT EXISTS style_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE preferences
      DROP COLUMN IF EXISTS style_preferences;
    `);
  }
}
