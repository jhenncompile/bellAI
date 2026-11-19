import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { canSubmitRoleChange, getAvailableUserActions } from '../utils/users-actions.ts';

const baseUser = {
  id: 'target-id',
  name: 'Cuenta de prueba',
  email: 'cuenta@bellia.test',
  role: 'user',
  status: 'active',
  createdAt: '2026-11-04T12:00:00.000Z',
};

test('ofrece suspensión sólo para una cuenta activa ajena', () => {
  assert.deepEqual(getAvailableUserActions(baseUser, 'admin-id'), {
    canSuspend: true,
    canReactivate: false,
    canChangeRole: true,
  });
});

test('ofrece reactivación sólo para una cuenta suspendida ajena', () => {
  const actions = getAvailableUserActions({ ...baseUser, status: 'suspended' }, 'admin-id');
  assert.equal(actions.canSuspend, false);
  assert.equal(actions.canReactivate, true);
});

test('no ofrece transición de estado para una cuenta inactiva', () => {
  const actions = getAvailableUserActions({ ...baseUser, status: 'inactive' }, 'admin-id');
  assert.equal(actions.canSuspend, false);
  assert.equal(actions.canReactivate, false);
});

test('impide visualmente autosuspender o autodegradar al administrador actual', () => {
  const currentAdmin = { ...baseUser, id: 'admin-id', role: 'admin' };
  const actions = getAvailableUserActions(currentAdmin, 'admin-id');
  assert.equal(actions.canSuspend, false);
  assert.equal(actions.canChangeRole, false);
  assert.equal(canSubmitRoleChange(currentAdmin, 'user', 'admin-id'), false);
  assert.equal(canSubmitRoleChange(currentAdmin, 'manager', 'admin-id'), false);
});

test('no envía cambios al mismo rol y admite roles distintos de otras cuentas', () => {
  assert.equal(canSubmitRoleChange(baseUser, 'user', 'admin-id'), false);
  assert.equal(canSubmitRoleChange(baseUser, 'manager', 'admin-id'), true);
  assert.equal(canSubmitRoleChange(baseUser, 'admin', 'admin-id'), true);
});

test('los diálogos exigen confirmación, conservan errores y bloquean durante el envío', async () => {
  const statusDialog = await readFile(
    new URL('../components/UserStatusDialog.tsx', import.meta.url),
    'utf8',
  );
  const roleDialog = await readFile(
    new URL('../components/UserRoleDialog.tsx', import.meta.url),
    'utf8',
  );
  assert.match(statusDialog, /Confirmar suspensi/);
  assert.match(statusDialog, /errorMessage/);
  assert.match(statusDialog, /disabled=\{pending\}/);
  assert.match(roleDialog, /setConfirming\(true\)/);
  assert.match(roleDialog, /Confirmar cambio/);
  assert.match(roleDialog, /canSubmitRoleChange/);
});

test('mantiene creación y eliminación y usa únicamente los endpoints existentes', async () => {
  const pageSource = await readFile(new URL('../pages/UsersPage.tsx', import.meta.url), 'utf8');
  const serviceSource = await readFile(
    new URL('../services/users.service.ts', import.meta.url),
    'utf8',
  );
  assert.match(pageSource, /createUser/);
  assert.match(pageSource, /deleteUser/);
  assert.match(serviceSource, /\/usuarios\/\$\{id\}\/status/);
  assert.match(serviceSource, /\/usuarios\/\$\{id\}\/role/);
  assert.doesNotMatch(serviceSource, /mock|fixture|simulad/i);
});
