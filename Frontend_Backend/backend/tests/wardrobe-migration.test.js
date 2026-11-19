'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  AddOccasionAndAccessoriesToWardrobe1700000000006,
} = require('../src/migrations/1700000000006-AddOccasionAndAccessoriesToWardrobe');

test('0006 define el esquema base previo sin occasion ni accesorios', () => {
  const migration = new AddOccasionAndAccessoriesToWardrobe1700000000006();
  const table = migration.createBaseWardrobeTable();
  const columnNames = table.columns.map((column) => column.name);
  const categoryCheck = table.checks.find(
    (check) => check.name === 'wardrobe_items_category_check',
  );

  assert.equal(table.name, 'wardrobe_items');
  assert.ok(columnNames.includes('id'));
  assert.ok(columnNames.includes('user_id'));
  assert.ok(columnNames.includes('ai_metadata'));
  assert.ok(!columnNames.includes('occasion'));
  assert.match(categoryCheck.expression, /'abrigo'/);
  assert.doesNotMatch(categoryCheck.expression, /'accesorio'/);
  assert.ok(
    table.foreignKeys.some(
      (foreignKey) =>
        foreignKey.columnNames[0] === 'user_id' &&
        foreignKey.referencedTableName === 'users' &&
        foreignKey.onDelete === 'CASCADE',
    ),
  );
});

test('0006 crea la tabla base sólo cuando no existe', async () => {
  const migration = new AddOccasionAndAccessoriesToWardrobe1700000000006();
  let createdTable;
  const indexes = [];
  const queries = [];
  const runner = {
    hasTable: async () => createdTable !== undefined,
    createTable: async (table) => { createdTable = table; },
    getTable: async () => createdTable,
    createIndex: async (_table, index) => { indexes.push(index.name); },
    query: async (sql) => { queries.push(sql); return []; },
  };

  await migration.up(runner);

  assert.equal(createdTable.name, 'wardrobe_items');
  assert.deepEqual(indexes.sort(), [
    'idx_wardrobe_user_category',
    'idx_wardrobe_user_id',
    'idx_wardrobe_user_status',
    'idx_wardrobe_user_subcategory',
  ]);
  assert.ok(queries.some((sql) => /ADD COLUMN IF NOT EXISTS occasion/.test(sql)));
  assert.ok(queries.some((sql) => /DROP CONSTRAINT IF EXISTS wardrobe_items_occasion_check/.test(sql)));
  assert.ok(queries.some((sql) => /ADD CONSTRAINT wardrobe_items_occasion_check/.test(sql)));
  assert.ok(queries.some((sql) => /idx_wardrobe_user_occasion/.test(sql)));
});

test('0006 se detiene ante una tabla existente incompatible', async () => {
  const migration = new AddOccasionAndAccessoriesToWardrobe1700000000006();
  const runner = {
    hasTable: async () => true,
    getTable: async () => ({
      findColumnByName: (name) => (name === 'id' ? { name: 'id', isPrimary: true } : undefined),
      foreignKeys: [],
      indices: [],
      checks: [],
    }),
  };

  await assert.rejects(
    () => migration.up(runner),
    /wardrobe_items existente es incompatible.*faltan columnas.*user_id.*ON DELETE CASCADE/,
  );
});

test('el rollback nunca elimina la tabla wardrobe_items', async () => {
  const migration = new AddOccasionAndAccessoriesToWardrobe1700000000006();
  const queries = [];
  await migration.down({
    hasTable: async () => true,
    query: async (sql) => { queries.push(sql); },
  });

  assert.ok(queries.some((sql) => /DROP COLUMN IF EXISTS occasion/.test(sql)));
  assert.ok(queries.every((sql) => !/DROP TABLE/i.test(sql)));
});
