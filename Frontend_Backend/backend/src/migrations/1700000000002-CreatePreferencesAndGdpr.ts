import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableCheck,
} from 'typeorm';

export class CreatePreferencesAndGdpr1700000000002 implements MigrationInterface {
  name = 'CreatePreferencesAndGdpr1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla: preferences
    await queryRunner.createTable(
      new Table({
        name: 'preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'theme',
            type: 'varchar',
            length: '20',
            default: "'system'",
            isNullable: false,
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'es'",
            isNullable: false,
          },
          {
            name: 'email_notifications',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'push_notifications',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'marketing_consent',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'tracking_consent',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        checks: [
          new TableCheck({
            name: 'chk_preferences_theme',
            expression: `"theme" IN ('light', 'dark', 'system')`,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );

    // 2. Tabla: gdpr_consents
    await queryRunner.createTable(
      new Table({
        name: 'gdpr_consents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'consent_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'accepted',
            type: 'boolean',
            isNullable: false,
          },
          {
            name: 'policy_version',
            type: 'varchar',
            length: '50',
            default: "'v1.0'",
            isNullable: false,
          },
          {
            name: 'ip_hash',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );

    // 3. Tabla: audit_logs
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
      true,
    );

    // schema.sql puede haber creado estos índices al inicializar PostgreSQL en Docker.
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_preferences_user_id" ON "preferences" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_gdpr_consents_user_id" ON "gdpr_consents" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" ("action")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs', true);
    await queryRunner.dropTable('gdpr_consents', true);
    await queryRunner.dropTable('preferences', true);
  }
}
