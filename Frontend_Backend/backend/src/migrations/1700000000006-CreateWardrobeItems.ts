import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Armario digital (HU-009, HU-011, HU-040).
 *
 * - Crea la tabla `wardrobe_items`, que hasta ahora sólo existía en `schema.sql`.
 * - Añade a `preferences` las columnas de sincronización que usa `PATCH /api/wardrobe/sync/settings`.
 *
 * Es idempotente: una base creada desde `schema.sql` ya tiene todo y esta migración no cambia nada.
 */
export class CreateWardrobeItems1700000000006 implements MigrationInterface {
  name = 'CreateWardrobeItems1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS wardrobe_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(150),
        category VARCHAR(30) NOT NULL CHECK (
          category IN ('superior', 'inferior', 'calzado', 'abrigo')
        ),
        subcategory VARCHAR(50) NOT NULL DEFAULT 'otros' CHECK (
          subcategory IN (
            'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
            'pantalones', 'jeans', 'faldas', 'shorts',
            'chaquetas', 'abrigos', 'sueteres', 'blazers',
            'zapatillas', 'tacones', 'botas', 'sandalias', 'otros'
          )
        ),
        color VARCHAR(60),
        color_hex VARCHAR(7),
        approximate_size VARCHAR(20),
        season VARCHAR(30) CHECK (
          season IN ('primavera', 'verano', 'otono', 'invierno', 'todo_el_ano')
        ),
        capture_source VARCHAR(20) NOT NULL DEFAULT 'camera' CHECK (
          capture_source IN ('camera', 'gallery')
        ),
        original_image_url VARCHAR(500),
        enhanced_image_url VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (
          status IN ('draft', 'processing', 'confirmed', 'upload_failed')
        ),
        last_worn_at TIMESTAMP WITH TIME ZONE,
        wear_count INTEGER NOT NULL DEFAULT 0,
        ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wardrobe_user_id ON wardrobe_items(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category ON wardrobe_items(user_id, category);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wardrobe_user_subcategory ON wardrobe_items(user_id, subcategory);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wardrobe_user_status ON wardrobe_items(user_id, status);`);

    await queryRunner.query(`
      ALTER TABLE preferences ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    await queryRunner.query(`
      ALTER TABLE preferences ADD COLUMN IF NOT EXISTS offline_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    await queryRunner.query(`
      ALTER TABLE preferences ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wardrobe_items;`);
    await queryRunner.query(`ALTER TABLE preferences DROP COLUMN IF EXISTS last_synced_at;`);
    await queryRunner.query(`ALTER TABLE preferences DROP COLUMN IF EXISTS offline_mode_enabled;`);
    await queryRunner.query(`ALTER TABLE preferences DROP COLUMN IF EXISTS auto_backup_enabled;`);
  }
}
