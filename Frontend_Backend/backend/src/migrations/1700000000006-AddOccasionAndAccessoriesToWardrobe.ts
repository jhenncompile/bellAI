import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddOccasionAndAccessoriesToWardrobe1700000000006 implements MigrationInterface {
  name = 'AddOccasionAndAccessoriesToWardrobe1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureBaseWardrobeTable(queryRunner);

    // 1. Agregar columna occasion con su restricción CHECK (HU-16)
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD COLUMN IF NOT EXISTS occasion VARCHAR(30);
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP CONSTRAINT IF EXISTS wardrobe_items_occasion_check;
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD CONSTRAINT wardrobe_items_occasion_check
      CHECK (occasion IS NULL OR occasion IN ('casual', 'formal', 'fiesta', 'deporte', 'trabajo', 'playa', 'gala'));
    `);

    // 2. Actualizar la restricción CHECK de categoría para permitir 'accesorio' (HU-14)
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP CONSTRAINT IF EXISTS wardrobe_items_category_check;
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD CONSTRAINT wardrobe_items_category_check
      CHECK (category IN ('superior', 'inferior', 'calzado', 'abrigo', 'accesorio'));
    `);

    // 3. Actualizar la restricción CHECK de subcategoría para incluir subcategorías de accesorios (HU-14)
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP CONSTRAINT IF EXISTS wardrobe_items_subcategory_check;
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD CONSTRAINT wardrobe_items_subcategory_check
      CHECK (subcategory IN (
        'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
        'pantalones', 'jeans', 'faldas', 'shorts',
        'chaquetas', 'abrigos', 'sueteres', 'blazers',
        'zapatillas', 'tacones', 'botas', 'sandalias',
        'bolsos', 'cinturones', 'joyeria', 'sombreros', 'bufandas', 'lentes', 'relojes',
        'otros'
      ));
    `);

    // 4. Crear índice compuesto para acelerar búsquedas combinadas por usuario y ocasión (HU-16)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wardrobe_user_occasion ON wardrobe_items(user_id, occasion);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('wardrobe_items'))) {
      return;
    }

    // Revertir índice
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_wardrobe_user_occasion;
    `);

    // Revertir subcategorías
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP CONSTRAINT IF EXISTS wardrobe_items_subcategory_check;
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD CONSTRAINT wardrobe_items_subcategory_check
      CHECK (subcategory IN (
        'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
        'pantalones', 'jeans', 'faldas', 'shorts',
        'chaquetas', 'abrigos', 'sueteres', 'blazers',
        'zapatillas', 'tacones', 'botas', 'sandalias', 'otros'
      ));
    `);

    // Revertir categorías
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP CONSTRAINT IF EXISTS wardrobe_items_category_check;
    `);

    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      ADD CONSTRAINT wardrobe_items_category_check
      CHECK (category IN ('superior', 'inferior', 'calzado', 'abrigo'));
    `);

    // Revertir columna occasion
    await queryRunner.query(`
      ALTER TABLE wardrobe_items
      DROP COLUMN IF EXISTS occasion;
    `);
  }

  private async ensureBaseWardrobeTable(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('wardrobe_items'))) {
      await queryRunner.createTable(this.createBaseWardrobeTable(), true);
    }

    const table = await queryRunner.getTable('wardrobe_items');
    if (!table) {
      throw new Error(
        'La migración 0006 no pudo preparar wardrobe_items: la tabla no está disponible.',
      );
    }

    const requiredColumns = [
      'id',
      'user_id',
      'name',
      'category',
      'subcategory',
      'color',
      'color_hex',
      'approximate_size',
      'season',
      'capture_source',
      'original_image_url',
      'enhanced_image_url',
      'status',
      'last_worn_at',
      'wear_count',
      'ai_metadata',
      'created_at',
      'updated_at',
    ];
    const missingColumns = requiredColumns.filter((name) => !table.findColumnByName(name));
    const idColumn = table.findColumnByName('id');
    const userForeignKey = table.foreignKeys.find(
      (foreignKey) =>
        foreignKey.columnNames.length === 1 &&
        foreignKey.columnNames[0] === 'user_id' &&
        foreignKey.referencedTableName === 'users' &&
        foreignKey.referencedColumnNames.length === 1 &&
        foreignKey.referencedColumnNames[0] === 'id' &&
        foreignKey.onDelete?.toUpperCase() === 'CASCADE',
    );

    const incompatibilities: string[] = [];
    if (missingColumns.length > 0) {
      incompatibilities.push(`faltan columnas: ${missingColumns.join(', ')}`);
    }
    if (!idColumn?.isPrimary) {
      incompatibilities.push('id no es la clave primaria');
    }
    if (!userForeignKey) {
      incompatibilities.push('user_id no referencia users(id) con ON DELETE CASCADE');
    }

    for (const [name, expectedType] of [
      ['id', 'uuid'],
      ['user_id', 'uuid'],
      ['category', 'varchar'],
      ['subcategory', 'varchar'],
      ['occasion', 'varchar'],
    ] as const) {
      const column = table.findColumnByName(name);
      if (column && !this.isCompatibleType(column.type, expectedType)) {
        incompatibilities.push(`${name} tiene tipo ${column.type || 'desconocido'}, se esperaba ${expectedType}`);
      }
    }

    for (const checkName of [
      'wardrobe_items_season_check',
      'wardrobe_items_capture_source_check',
      'wardrobe_items_status_check',
    ]) {
      if (!table.checks.some((check) => check.name === checkName)) {
        incompatibilities.push(`falta la restricción ${checkName}`);
      }
    }

    if (incompatibilities.length > 0) {
      throw new Error(
        `La tabla wardrobe_items existente es incompatible con la migración 0006: ${incompatibilities.join('; ')}.`,
      );
    }

    const invalidRows = await queryRunner.query(`
      SELECT id
      FROM wardrobe_items
      WHERE category NOT IN ('superior', 'inferior', 'calzado', 'abrigo', 'accesorio')
         OR subcategory NOT IN (
           'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
           'pantalones', 'jeans', 'faldas', 'shorts',
           'chaquetas', 'abrigos', 'sueteres', 'blazers',
           'zapatillas', 'tacones', 'botas', 'sandalias',
           'bolsos', 'cinturones', 'joyeria', 'sombreros', 'bufandas', 'lentes', 'relojes',
           'otros'
         )
      LIMIT 1;
    `);
    if (invalidRows.length > 0) {
      throw new Error(
        'La tabla wardrobe_items contiene categorías o subcategorías incompatibles con la migración 0006.',
      );
    }

    await this.ensureBaseIndexes(queryRunner, table);
  }

  private createBaseWardrobeTable(): Table {
    return new Table({
      name: 'wardrobe_items',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'uuid',
          default: 'gen_random_uuid()',
        },
        { name: 'user_id', type: 'uuid', isNullable: false },
        { name: 'name', type: 'varchar', length: '150', isNullable: true },
        { name: 'category', type: 'varchar', length: '30', isNullable: false },
        {
          name: 'subcategory',
          type: 'varchar',
          length: '50',
          isNullable: false,
          default: "'otros'",
        },
        { name: 'color', type: 'varchar', length: '60', isNullable: true },
        { name: 'color_hex', type: 'varchar', length: '7', isNullable: true },
        { name: 'approximate_size', type: 'varchar', length: '20', isNullable: true },
        { name: 'season', type: 'varchar', length: '30', isNullable: true },
        {
          name: 'capture_source',
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'camera'",
        },
        { name: 'original_image_url', type: 'varchar', length: '500', isNullable: true },
        { name: 'enhanced_image_url', type: 'varchar', length: '500', isNullable: true },
        {
          name: 'status',
          type: 'varchar',
          length: '20',
          isNullable: false,
          default: "'confirmed'",
        },
        { name: 'last_worn_at', type: 'timestamptz', isNullable: true },
        { name: 'wear_count', type: 'int', isNullable: false, default: 0 },
        {
          name: 'ai_metadata',
          type: 'jsonb',
          isNullable: false,
          default: "'{}'::jsonb",
        },
        {
          name: 'created_at',
          type: 'timestamptz',
          isNullable: false,
          default: 'CURRENT_TIMESTAMP',
        },
        {
          name: 'updated_at',
          type: 'timestamptz',
          isNullable: false,
          default: 'CURRENT_TIMESTAMP',
        },
      ],
      checks: [
        new TableCheck({
          name: 'wardrobe_items_category_check',
          expression: `"category" IN ('superior', 'inferior', 'calzado', 'abrigo')`,
        }),
        new TableCheck({
          name: 'wardrobe_items_subcategory_check',
          expression: `"subcategory" IN (
            'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
            'pantalones', 'jeans', 'faldas', 'shorts',
            'chaquetas', 'abrigos', 'sueteres', 'blazers',
            'zapatillas', 'tacones', 'botas', 'sandalias', 'otros'
          )`,
        }),
        new TableCheck({
          name: 'wardrobe_items_season_check',
          expression: `"season" IS NULL OR "season" IN ('primavera', 'verano', 'otono', 'invierno', 'todo_el_ano')`,
        }),
        new TableCheck({
          name: 'wardrobe_items_capture_source_check',
          expression: `"capture_source" IN ('camera', 'gallery')`,
        }),
        new TableCheck({
          name: 'wardrobe_items_status_check',
          expression: `"status" IN ('draft', 'processing', 'confirmed', 'upload_failed')`,
        }),
      ],
      foreignKeys: [
        new TableForeignKey({
          name: 'wardrobe_items_user_id_fkey',
          columnNames: ['user_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      ],
    });
  }

  private isCompatibleType(actual: string | undefined, expected: 'uuid' | 'varchar'): boolean {
    if (!actual) return false;
    const normalized = actual.toLowerCase();
    return expected === 'varchar'
      ? normalized === 'varchar' || normalized === 'character varying'
      : normalized === expected;
  }

  private async ensureBaseIndexes(queryRunner: QueryRunner, table: Table): Promise<void> {
    const indexes = [
      new TableIndex({ name: 'idx_wardrobe_user_id', columnNames: ['user_id'] }),
      new TableIndex({
        name: 'idx_wardrobe_user_category',
        columnNames: ['user_id', 'category'],
      }),
      new TableIndex({
        name: 'idx_wardrobe_user_subcategory',
        columnNames: ['user_id', 'subcategory'],
      }),
      new TableIndex({
        name: 'idx_wardrobe_user_status',
        columnNames: ['user_id', 'status'],
      }),
    ];

    for (const index of indexes) {
      if (!table.indices.some((existing) => existing.name === index.name)) {
        await queryRunner.createIndex('wardrobe_items', index);
      }
    }
  }
}
