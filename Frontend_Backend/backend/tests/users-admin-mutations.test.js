'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ParseUUIDPipe, ValidationPipe } = require('@nestjs/common');
const { UsersController } = require('../src/modules/users/users.controller');
const { UsersService } = require('../src/modules/users/users.service');
const { User } = require('../src/modules/users/entities/user.entity');
const { AuditLog } = require('../src/modules/privacy/entities/audit-log.entity');
const { UpdateUserRoleDto } = require('../src/modules/users/dto/update-user-role.dto');
const { UpdateUserStatusDto } = require('../src/modules/users/dto/update-user-status.dto');

const ADMIN_A = '11111111-1111-4111-8111-111111111111';
const ADMIN_B = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function account(id, role = 'user', status = 'active') {
  return { id, name: 'Cuenta de prueba', email: 'test@example.test', role, status };
}

function createHarness(initialUsers, { failAudit = false } = {}) {
  let usersState = initialUsers.map((user) => ({ ...user }));
  const auditState = [];
  const observations = { userSaves: 0, auditSaves: 0, locks: [], orders: [] };
  let transactionTail = Promise.resolve();

  const transactionalManager = {
    getRepository(entity) {
      if (entity === User) {
        return {
          createQueryBuilder() {
            let params;
            return {
              where(_sql, nextParams) { params = nextParams; return this; },
              orderBy(column, direction) {
                observations.orders.push({ column, direction });
                return this;
              },
              setLock(mode) { observations.locks.push(mode); return this; },
              async getMany() {
                return usersState
                  .filter((user) =>
                    user.id === params.targetId ||
                    user.id === params.actorUserId ||
                    user.role === params.adminRole)
                  .sort((left, right) => left.id.localeCompare(right.id));
              },
            };
          },
          async save(user) {
            observations.userSaves += 1;
            return user;
          },
        };
      }
      if (entity === AuditLog) {
        return {
          create: (event) => ({ ...event }),
          async save(event) {
            observations.auditSaves += 1;
            if (failAudit) throw new Error('Fallo de auditoría simulado');
            auditState.push({ ...event });
            return event;
          },
        };
      }
      throw new Error(`Repositorio inesperado: ${entity?.name}`);
    },
  };

  const rootManager = {
    async transaction(callback) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;

      const usersSnapshot = usersState.map((user) => ({ ...user }));
      const auditLength = auditState.length;
      try {
        return await callback(transactionalManager);
      } catch (error) {
        usersState = usersSnapshot;
        auditState.splice(auditLength);
        throw error;
      } finally {
        release();
      }
    },
  };

  const rootUserRepository = { manager: rootManager };
  const service = new UsersService(rootUserRepository, {}, {}, {}, {});
  return {
    service,
    observations,
    audits: auditState,
    users: () => usersState,
  };
}

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

test('los DTO aceptan únicamente estados y roles conocidos', async () => {
  const statusMetadata = { type: 'body', metatype: UpdateUserStatusDto };
  const roleMetadata = { type: 'body', metatype: UpdateUserRoleDto };
  assert.equal((await validationPipe.transform({ status: 'suspended' }, statusMetadata)).status, 'suspended');
  assert.equal((await validationPipe.transform({ role: 'manager' }, roleMetadata)).role, 'manager');

  for (const body of [{}, { status: 'blocked' }, { status: 1 }]) {
    await assert.rejects(() => validationPipe.transform(body, statusMetadata), { status: 400 });
  }
  for (const body of [{}, { role: 'owner' }, { role: 1 }]) {
    await assert.rejects(() => validationPipe.transform(body, roleMetadata), { status: 400 });
  }
});

test('ParseUUIDPipe rechaza identificadores incorrectos con 400', async () => {
  await assert.rejects(
    () => new ParseUUIDPipe().transform('no-es-uuid', { type: 'param' }),
    { status: 400 },
  );
});

test('un administrador activo puede suspender y reactivar una cuenta', async () => {
  const harness = createHarness([
    account(ADMIN_A, 'admin'),
    account(USER_ID),
  ]);
  const suspended = await harness.service.updateStatus(USER_ID, 'suspended', ADMIN_A);
  assert.equal(suspended.status, 'suspended');
  const reactivated = await harness.service.updateStatus(USER_ID, 'active', ADMIN_A);
  assert.equal(reactivated.status, 'active');
  assert.deepEqual(harness.audits.map((event) => event.details), [
    { previousStatus: 'active', newStatus: 'suspended' },
    { previousStatus: 'suspended', newStatus: 'active' },
  ]);
});

test('un administrador activo puede asignar un rol permitido', async () => {
  const harness = createHarness([account(ADMIN_A, 'admin'), account(USER_ID)]);
  const updated = await harness.service.updateRole(USER_ID, 'manager', ADMIN_A);
  assert.equal(updated.role, 'manager');
  assert.deepEqual(harness.audits[0], {
    userId: ADMIN_A,
    action: 'USER_ROLE_CHANGED',
    entityType: 'user',
    entityId: USER_ID,
    details: { previousRole: 'user', newRole: 'manager' },
    success: true,
  });
});

test('un actor que ya no es administrador activo recibe 403 dentro de la transacción', async () => {
  const harness = createHarness([account(ADMIN_A, 'manager'), account(USER_ID)]);
  await assert.rejects(
    () => harness.service.updateStatus(USER_ID, 'suspended', ADMIN_A),
    { status: 403 },
  );
});

test('un usuario inexistente recibe 404', async () => {
  const harness = createHarness([account(ADMIN_A, 'admin')]);
  await assert.rejects(
    () => harness.service.updateStatus(USER_ID, 'suspended', ADMIN_A),
    { status: 404 },
  );
});

test('se rechazan autosuspensión y autodegradación', async () => {
  const statusHarness = createHarness([account(ADMIN_A, 'admin'), account(ADMIN_B, 'admin')]);
  await assert.rejects(
    () => statusHarness.service.updateStatus(ADMIN_A, 'suspended', ADMIN_A),
    { status: 409 },
  );

  const roleHarness = createHarness([account(ADMIN_A, 'admin'), account(ADMIN_B, 'admin')]);
  await assert.rejects(
    () => roleHarness.service.updateRole(ADMIN_A, 'manager', ADMIN_A),
    { status: 409 },
  );
});

test('se protege al último administrador activo', async () => {
  const statusHarness = createHarness([account(ADMIN_A, 'admin'), account(USER_ID)]);
  await assert.rejects(
    () => statusHarness.service.updateStatus(ADMIN_A, 'suspended', ADMIN_A),
    { status: 409 },
  );

  const roleHarness = createHarness([account(ADMIN_A, 'admin'), account(USER_ID)]);
  await assert.rejects(
    () => roleHarness.service.updateRole(ADMIN_A, 'user', ADMIN_A),
    { status: 409 },
  );
});

test('un administrador distinto no puede suspender ni degradar al último administrador', async () => {
  const suspendedActor = account(ADMIN_B, 'admin', 'suspended');
  const statusHarness = createHarness([account(ADMIN_A, 'admin'), suspendedActor]);
  await assert.rejects(
    () => statusHarness.service.updateStatus(ADMIN_A, 'suspended', ADMIN_B),
    { status: 403 },
  );

  const inactiveActor = account(ADMIN_B, 'admin', 'inactive');
  const roleHarness = createHarness([account(ADMIN_A, 'admin'), inactiveActor]);
  await assert.rejects(
    () => roleHarness.service.updateRole(ADMIN_A, 'user', ADMIN_B),
    { status: 403 },
  );
});

test('dos operaciones concurrentes no dejan al sistema sin administradores activos', async () => {
  const harness = createHarness([account(ADMIN_A, 'admin'), account(ADMIN_B, 'admin')]);
  const results = await Promise.allSettled([
    harness.service.updateRole(ADMIN_A, 'user', ADMIN_B),
    harness.service.updateRole(ADMIN_B, 'user', ADMIN_A),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(
    harness.users().filter((user) => user.role === 'admin' && user.status === 'active').length,
    1,
  );
  assert.ok(harness.observations.locks.every((lock) => lock === 'pessimistic_write'));
  assert.ok(harness.observations.orders.every((order) => order.column === 'user.id'));
});

test('el cambio y la auditoría son atómicos', async () => {
  const harness = createHarness(
    [account(ADMIN_A, 'admin'), account(USER_ID)],
    { failAudit: true },
  );
  await assert.rejects(
    () => harness.service.updateStatus(USER_ID, 'suspended', ADMIN_A),
    /Fallo de auditoría simulado/,
  );
  assert.equal(harness.users().find((user) => user.id === USER_ID).status, 'active');
  assert.equal(harness.audits.length, 0);
});

test('una operación sin cambio efectivo no escribe ni audita', async () => {
  const harness = createHarness([account(ADMIN_A, 'admin'), account(USER_ID)]);
  await harness.service.updateStatus(USER_ID, 'active', ADMIN_A);
  await harness.service.updateRole(USER_ID, 'user', ADMIN_A);
  assert.equal(harness.observations.userSaves, 0);
  assert.equal(harness.observations.auditSaves, 0);
  assert.equal(harness.audits.length, 0);
});

test('los eventos contienen solo identificadores y cambios de rol o estado', async () => {
  const harness = createHarness([account(ADMIN_A, 'admin'), account(USER_ID)]);
  await harness.service.updateStatus(USER_ID, 'suspended', ADMIN_A);
  const serialized = JSON.stringify(harness.audits[0]);
  assert.equal(harness.audits[0].action, 'USER_STATUS_CHANGED');
  assert.deepEqual(Object.keys(harness.audits[0].details).sort(), ['newStatus', 'previousStatus']);
  assert.doesNotMatch(serialized, /email|name|password|token|header/i);
});

test('el controlador conserva los cuerpos y respuestas de los endpoints existentes', async () => {
  const calls = [];
  const controller = new UsersController({
    updateStatus: async (...args) => { calls.push(args); return { status: args[1] }; },
    updateRole: async (...args) => { calls.push(args); return { role: args[1] }; },
  });
  assert.deepEqual(
    await controller.updateStatus(USER_ID, { status: 'suspended' }, { id: ADMIN_A }),
    { status: 'suspended' },
  );
  assert.deepEqual(
    await controller.updateRole(USER_ID, { role: 'manager' }, { id: ADMIN_A }),
    { role: 'manager' },
  );
  assert.deepEqual(calls, [
    [USER_ID, 'suspended', ADMIN_A],
    [USER_ID, 'manager', ADMIN_A],
  ]);
});
