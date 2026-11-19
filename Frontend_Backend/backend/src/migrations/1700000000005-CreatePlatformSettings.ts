import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreatePlatformSettings1700000000005 implements MigrationInterface {
  name = 'CreatePlatformSettings1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('platform_settings');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_settings',
          columns: [
            {
              name: 'key',
              type: 'varchar',
              length: '64',
              isPrimary: true,
              isNullable: false,
            },
            {
              name: 'value',
              type: 'jsonb',
              isNullable: false,
            },
            {
              name: 'updated_by',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
            {
              name: 'updated_at',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'platform_settings',
        new TableForeignKey({
          columnNames: ['updated_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        }),
      );

      await queryRunner.createIndex(
        'platform_settings',
        new TableIndex({
          name: 'idx_platform_settings_updated_by',
          columnNames: ['updated_by'],
        }),
      );

      // Seed valores por defecto
      await queryRunner.query(`
        INSERT INTO platform_settings (key, value)
        VALUES
          ('maintenance_mode', 'false'::jsonb),
          ('user_creation_enabled', 'true'::jsonb)
        ON CONFLICT (key) DO NOTHING;
      `);
    }

    // Asegurar columnas en audit_logs si la tabla existe
    const hasAuditTable = await queryRunner.hasTable('audit_logs');
    if (hasAuditTable) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(50);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND column_name = 'entity_id'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN entity_id VARCHAR(100);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND column_name = 'success'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN success BOOLEAN DEFAULT TRUE;
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('platform_settings')) {
      await queryRunner.dropTable('platform_settings');
    }
  }
}
