import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  buildUsersRequestParams,
  USERS_PAGE_SIZE,
  USER_STATUS_PRESENTATION,
} from '../utils/users-query.ts';

test('construye los parámetros HTTP de búsqueda y paginación', () => {
  assert.deepEqual(
    buildUsersRequestParams({ search: '  nombre@correo.test  ', page: 2, pageSize: 20 }),
    { search: 'nombre@correo.test', page: 2, pageSize: 20 },
  );
});

test('combina rol, estado, búsqueda y paginación', () => {
  assert.deepEqual(
    buildUsersRequestParams({
      search: 'cuenta',
      role: 'manager',
      status: 'suspended',
      page: 3,
      pageSize: USERS_PAGE_SIZE,
    }),
    {
      search: 'cuenta',
      role: 'manager',
      status: 'suspended',
      page: 3,
      pageSize: 20,
    },
  );
});

test('omite búsqueda vacía y filtros todos', () => {
  assert.deepEqual(
    buildUsersRequestParams({ search: '   ', role: 'all', status: 'all' }),
    { page: 1, pageSize: 20 },
  );
});

test('los estados tienen etiquetas visuales diferentes', () => {
  assert.equal(USER_STATUS_PRESENTATION.active.label, 'Activo');
  assert.equal(USER_STATUS_PRESENTATION.inactive.label, 'Inactivo');
  assert.equal(USER_STATUS_PRESENTATION.suspended.label, 'Suspendido');
  assert.equal(new Set(Object.values(USER_STATUS_PRESENTATION).map((item) => item.label)).size, 3);
});

test('la pantalla usa React Query, reinicia filtros e integra las mutaciones administrativas', async () => {
  const pageSource = await readFile(new URL('../pages/UsersPage.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /useQuery\(/);
  assert.ok((pageSource.match(/setPage\(1\)/g) ?? []).length >= 3);
  assert.match(pageSource, /pagination\.total/);
  assert.match(pageSource, /status === 401/);
  assert.match(pageSource, /status === 403/);
  assert.match(pageSource, /useMutation\(/);
  assert.match(pageSource, /updateUserRole/);
  assert.match(pageSource, /updateUserStatus/);
  assert.match(pageSource, /invalidateQueries/);
});

test('la tabla usa fecha real y no presenta lastActive como presencia confirmada', async () => {
  const tableSource = await readFile(new URL('../components/UserTable.tsx', import.meta.url), 'utf8');
  assert.match(tableSource, /user\.createdAt/);
  assert.doesNotMatch(tableSource, /lastActive|En línea/);
  assert.match(tableSource, /USER_STATUS_PRESENTATION/);
});

test('el servicio consume el contrato paginado sin datos simulados ni fallback de array', async () => {
  const serviceSource = await readFile(new URL('../services/users.service.ts', import.meta.url), 'utf8');
  assert.match(serviceSource, /Promise<UsersListResponse>/);
  assert.match(serviceSource, /buildUsersRequestParams\(filters\)/);
  assert.doesNotMatch(serviceSource, /Array\.isArray|mock|fixture|simulad/i);
});
