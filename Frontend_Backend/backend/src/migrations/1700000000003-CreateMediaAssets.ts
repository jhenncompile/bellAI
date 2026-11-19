import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableCheck,
} from 'typeorm';

export class CreateMediaAssets1700000000003 implements MigrationInterface {
  name = 'CreateMediaAssets1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabla: media_assets (HU-033: Supervisión Multimedia y Modelos)
    await queryRunner.createTable(
      new Table({
        name: 'media_assets',
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
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'original_filename',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 's3_key',
            type: 'varchar',
            length: '500',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 's3_bucket',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 's3_url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'cdn_url',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'media_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'system_function',
            type: 'varchar',
            length: '100',
            default: "'general'",
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'used_by_components',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'extension',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'size_bytes',
            type: 'bigint',
            default: 0,
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: true,
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
            name: 'chk_media_assets_media_type',
            expression: `"media_type" IN ('photo', 'garment', 'model_3d', 'ai_component', 'texture', 'avatar')`,
          }),
          new TableCheck({
            name: 'chk_media_assets_system_function',
            expression: `"system_function" IN ('catalogo_prendas', 'probador_virtual_3d', 'motor_inferencia_ia', 'perfil_usuario', 'galeria_marketing', 'general')`,
          }),
          new TableCheck({
            name: 'chk_media_assets_status',
            expression: `"status" IN ('active', 'retired', 'maintenance')`,
          }),
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
      'CREATE INDEX IF NOT EXISTS "idx_media_assets_user_id" ON "media_assets" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_media_assets_s3_key" ON "media_assets" ("s3_key")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_media_assets_media_type" ON "media_assets" ("media_type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_media_assets_system_function" ON "media_assets" ("system_function")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_media_assets_is_active" ON "media_assets" ("is_active")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('media_assets', true);
  }
}
