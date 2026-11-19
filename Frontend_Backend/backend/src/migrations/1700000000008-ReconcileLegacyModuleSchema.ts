import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repara bases creadas antes de que el historial de TypeORM quedara sincronizado
 * con el esquema actual. Todas las operaciones son idempotentes y conservan datos.
 */
export class ReconcileLegacyModuleSchema1700000000008 implements MigrationInterface {
  name = 'ReconcileLegacyModuleSchema1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) UNIQUE NOT NULL,
        s3_bucket VARCHAR(150) NOT NULL,
        s3_url TEXT NOT NULL,
        cdn_url TEXT NOT NULL,
        media_type VARCHAR(50) NOT NULL
          CHECK (media_type IN ('photo', 'garment', 'model_3d', 'ai_component', 'texture', 'avatar')),
        system_function VARCHAR(100) NOT NULL DEFAULT 'general'
          CHECK (system_function IN ('catalogo_prendas', 'probador_virtual_3d', 'motor_inferencia_ia', 'perfil_usuario', 'galeria_marketing', 'general')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        used_by_components JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(50) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'retired', 'maintenance')),
        mime_type VARCHAR(150) NOT NULL,
        extension VARCHAR(20) NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
      CREATE INDEX IF NOT EXISTS idx_media_assets_s3_key ON media_assets(s3_key);
      CREATE INDEX IF NOT EXISTS idx_media_assets_media_type ON media_assets(media_type);
      CREATE INDEX IF NOT EXISTS idx_media_assets_system_function ON media_assets(system_function);
      CREATE INDEX IF NOT EXISTS idx_media_assets_is_active ON media_assets(is_active);

      ALTER TABLE audit_logs
        ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    if (await queryRunner.hasTable('platform_settings')) {
      for (const [legacyName, currentName] of [
        ['updatedBy', 'updated_by'],
        ['createdAt', 'created_at'],
        ['updatedAt', 'updated_at'],
      ]) {
        if (
          (await queryRunner.hasColumn('platform_settings', legacyName)) &&
          !(await queryRunner.hasColumn('platform_settings', currentName))
        ) {
          await queryRunner.query(
            `ALTER TABLE platform_settings RENAME COLUMN "${legacyName}" TO "${currentName}"`,
          );
        }
      }

      await queryRunner.query(`
        ALTER TABLE platform_settings
          ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by ON platform_settings(updated_by);
      `);
    }
  }

  public async down(): Promise<void> {
    // Reconciliation may add missing structures to databases that already contain data.
    // It intentionally has no destructive rollback.
  }
}
