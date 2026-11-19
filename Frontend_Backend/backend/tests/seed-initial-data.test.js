'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  SeedInitialData1700000000004,
} = require('../src/migrations/1700000000004-SeedInitialData');

function createRunner(existingUser) {
  const inserts = [];
  const manager = {
    createQueryBuilder() {
      const state = {};
      return {
        select() { return this; },
        from() { return this; },
        where() { return this; },
        getRawOne: async () => existingUser,
        insert() { return this; },
        into(table, columns) { state.table = table; state.columns = columns; return this; },
        values(values) { state.values = values; return this; },
        updateEntity(enabled) { state.updateEntity = enabled; return this; },
        execute: async () => { inserts.push(state); return {}; },
      };
    },
  };
  return { runner: { manager }, inserts };
}

test('0004 utiliza propiedades de entidad y conserva todas las relaciones', async () => {
  const { runner, inserts } = createRunner(undefined);
  await new SeedInitialData1700000000004().up(runner);

  assert.deepEqual(inserts.map((insert) => insert.table), [
    'users',
    'profiles',
    'preferences',
    'gdpr_consents',
    'media_assets',
  ]);

  const byTable = Object.fromEntries(inserts.map((insert) => [insert.table, insert.values]));
  assert.equal(byTable.profiles.userId, '11111111-1111-1111-1111-111111111111');
  assert.equal(byTable.preferences.userId, '11111111-1111-1111-1111-111111111111');
  assert.ok(byTable.gdpr_consents.every((consent) => consent.userId));
  assert.ok(byTable.media_assets.every((asset) => asset.userId));
  assert.ok(byTable.media_assets.every((asset) => Array.isArray(asset.usedByComponents)));
  assert.ok(byTable.media_assets.every((asset) => typeof asset.metadata === 'object'));
  assert.deepEqual(
    inserts.find((insert) => insert.table === 'preferences').columns,
    [
      'userId',
      'theme',
      'language',
      'emailNotifications',
      'pushNotifications',
      'marketingConsent',
      'trackingConsent',
    ],
  );
  assert.equal(
    inserts.find((insert) => insert.table === 'preferences').updateEntity,
    false,
  );

  const serialized = JSON.stringify(inserts);
  for (const physicalName of [
    'user_id',
    'phone_masked',
    'avatar_url',
    'email_notifications',
    'consent_type',
    'original_filename',
    's3_key',
    'media_type',
    'used_by_components',
    'size_bytes',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(`"${physicalName}"`));
  }
});

test('0004 no inserta datos duplicados cuando Valeria ya existe', async () => {
  const { runner, inserts } = createRunner({ id: '11111111-1111-1111-1111-111111111111' });
  await new SeedInitialData1700000000004().up(runner);
  assert.equal(inserts.length, 0);
});
