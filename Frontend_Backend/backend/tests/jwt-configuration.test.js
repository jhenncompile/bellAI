'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JwtService } = require('@nestjs/jwt');
const { getJwtSecret } = require('../src/modules/auth/jwt.config');
const { JwtStrategy } = require('../src/modules/auth/strategies/jwt.strategy');

const secret = 'clave-jwt-aislada-para-pruebas';
const config = { get: (key) => key === 'JWT_SECRET' ? secret : undefined };

test('firma y verificación usan la misma configuración sin depender de process.env', async () => {
  const previousSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const jwt = new JwtService({ secret: getJwtSecret(config), signOptions: { expiresIn: '7d' } });
    const token = jwt.sign({ sub: 'user-id', email: 'user@example.test', role: 'user' });
    const payload = await jwt.verifyAsync(token, { secret: getJwtSecret(config) });
    assert.equal(payload.sub, 'user-id');
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('la estrategia acepta una cuenta activa y rechaza una suspendida', async () => {
  const active = new JwtStrategy({ findOne: async () => ({ id: 'user-id', status: 'active' }) }, config);
  assert.equal((await active.validate({ sub: 'user-id', email: 'user@example.test', role: 'user' })).id, 'user-id');

  const suspended = new JwtStrategy({ findOne: async () => ({ id: 'user-id', status: 'suspended' }) }, config);
  await assert.rejects(
    suspended.validate({ sub: 'user-id', email: 'user@example.test', role: 'user' }),
    /Usuario inactivo o no autorizado/,
  );
});

test('token inválido o expirado no supera la verificación', async () => {
  const jwt = new JwtService({ secret });
  await assert.rejects(jwt.verifyAsync('token-invalido', { secret }));
  const expired = jwt.sign({ sub: 'user-id' }, { expiresIn: -1 });
  await assert.rejects(jwt.verifyAsync(expired, { secret }), /expired/i);
});

test('JWT_SECRET ausente produce un error de configuración claro', () => {
  assert.throws(
    () => getJwtSecret({ get: () => undefined }),
    /Falta la variable de configuración JWT_SECRET/,
  );
  assert.throws(
    () => getJwtSecret({ get: () => '   ' }),
    /Falta la variable de configuración JWT_SECRET/,
  );
});
