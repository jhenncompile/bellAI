'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  AddWardrobeSyncPreferences1700000000009,
} = require('../src/migrations/1700000000009-AddWardrobeSyncPreferences');
const { parseMigrationsRun } = require('../src/config/typeorm-migrations-run');

test('migrationsRun conserva true por defecto y acepta booleanos explícitos', () => {
  assert.equal(parseMigrationsRun(undefined), true);
  assert.equal(parseMigrationsRun(''), true);
  assert.equal(parseMigrationsRun(' true '), true);
  assert.equal(parseMigrationsRun('FALSE'), false);
});

test('migrationsRun rechaza valores ambiguos', () => {
  assert.throws(
    () => parseMigrationsRun('0'),
    /TYPEORM_MIGRATIONS_RUN debe ser "true" o "false"/,
  );
});

test('0009 añade las preferencias de sincronización de forma idempotente', async () => {
  const queries = [];
  await new AddWardrobeSyncPreferences1700000000009().up({
    query: async (sql) => queries.push(sql),
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0], /ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(queries[0], /ADD COLUMN IF NOT EXISTS offline_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(queries[0], /ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ/);
});
