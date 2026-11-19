'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { UsersController } = require('../src/modules/users/users.controller');
const { UsersService } = require('../src/modules/users/users.service');
const { ListUsersQueryDto } = require('../src/modules/users/dto/list-users-query.dto');
const { JwtAuthGuard } = require('../src/common/guards/jwt-auth.guard');
const { RolesGuard } = require('../src/common/guards/roles.guard');
const { ROLES_KEY } = require('../src/common/decorators/roles.decorator');
const { JwtStrategy } = require('../src/modules/auth/strategies/jwt.strategy');

const sampleUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Cuenta de prueba',
  email: 'cuenta@example.test',
  role: 'user',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  password: 'no-debe-salir',
  profile: { phoneEncrypted: 'no-debe-salir' },
  preferences: { trackingConsent: true },
};

class FakeQueryBuilder {
  constructor({ entities = [sampleUser], raw = [{ avatar: 'avatar.webp' }], total = 1 } = {}) {
    this.entities = entities;
    this.raw = raw;
    this.total = total;
    this.filters = [];
    this.selected = [];
    this.offset = null;
    this.limit = null;
    this.orders = [];
  }

  leftJoin() { return this; }
  select(columns) { this.selected = [...columns]; return this; }
  addSelect(column, alias) { this.selected.push(`${column} AS ${alias}`); return this; }
  andWhere(sql, params) { this.filters.push({ sql, params }); return this; }
  orderBy(column, direction) { this.orders.push({ column, direction }); return this; }
  addOrderBy(column, direction) { this.orders.push({ column, direction }); return this; }
  skip(value) { this.offset = value; return this; }
  take(value) { this.limit = value; return this; }
  async getCount() { return this.total; }
  async getRawAndEntities() { return { entities: this.entities, raw: this.raw }; }
}

function createHarness(options) {
  const builders = [];
  let writes = 0;
  const repository = {
    createQueryBuilder: () => {
      const builder = new FakeQueryBuilder(options);
      builders.push(builder);
      return builder;
    },
    save: async () => { writes += 1; throw new Error('Escritura inesperada'); },
    update: async () => { writes += 1; throw new Error('Escritura inesperada'); },
    delete: async () => { writes += 1; throw new Error('Escritura inesperada'); },
  };
  const unusedRepository = {};
  const settingsService = {};
  const service = new UsersService(
    repository,
    unusedRepository,
    unusedRepository,
    unusedRepository,
    settingsService,
  );
  return { service, builders, getWrites: () => writes };
}

function requestContext(user) {
  return {
    getHandler: () => UsersController.prototype.findAll,
    getClass: () => UsersController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});
const queryMetadata = { type: 'query', metatype: ListUsersQueryDto };

test('los endpoints de listado y detalle requieren JWT, RolesGuard y rol admin', () => {
  const controllerGuards = Reflect.getMetadata(GUARDS_METADATA, UsersController);
  assert.ok(controllerGuards.includes(JwtAuthGuard));
  assert.ok(controllerGuards.includes(RolesGuard));
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findAll), ['admin']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findOne), ['admin']);
});

test('una solicitud sin JWT recibe 401', () => {
  const guard = new JwtAuthGuard();
  assert.throws(() => guard.handleRequest(null, null), { status: 401 });
});

test('user y manager reciben 403, mientras admin puede continuar', () => {
  const guard = new RolesGuard({ getAllAndOverride: () => ['admin'] });
  for (const role of ['user', 'manager']) {
    assert.throws(() => guard.canActivate(requestContext({ role })), { status: 403 });
  }
  assert.equal(guard.canActivate(requestContext({ role: 'admin' })), true);
});

test('una cuenta administrativa suspendida es rechazada por la estrategia JWT', async () => {
  const strategy = new JwtStrategy({
    findOne: async () => ({ ...sampleUser, role: 'admin', status: 'suspended' }),
  }, { get: () => 'jwt-de-prueba' });
  await assert.rejects(() => strategy.validate({ sub: sampleUser.id }), { status: 401 });
});

test('el DTO transforma paginación, aplica defaults y conserva validaciones', async () => {
  const defaults = await validationPipe.transform({}, queryMetadata);
  assert.equal(defaults.page, 1);
  assert.equal(defaults.pageSize, 20);

  const transformed = await validationPipe.transform(
    { search: '  ejemplo  ', role: 'admin', status: 'active', page: '2', pageSize: '50' },
    queryMetadata,
  );
  assert.deepEqual(
    { ...transformed },
    { search: 'ejemplo', role: 'admin', status: 'active', page: 2, pageSize: 50 },
  );

  const frontendDefaults = await validationPipe.transform(
    { search: '', role: 'all' },
    queryMetadata,
  );
  assert.equal(frontendDefaults.search, undefined);
  assert.equal(frontendDefaults.role, undefined);
  assert.equal(frontendDefaults.page, 1);
  assert.equal(frontendDefaults.pageSize, 20);
});

test('el DTO rechaza filtros y paginación inválidos con 400', async () => {
  const invalidQueries = [
    { role: 'superadmin' },
    { status: 'blocked' },
    { page: '0' },
    { page: 'texto' },
    { pageSize: '101' },
    { search: 'x'.repeat(101) },
  ];
  for (const query of invalidQueries) {
    await assert.rejects(() => validationPipe.transform(query, queryMetadata), { status: 400 });
  }
});

test('construye búsqueda por nombre y correo con parámetro enlazado', async () => {
  const { service, builders } = createHarness();
  await service.findAllAdmin({ search: '%_Ejemplo', page: 1, pageSize: 20 });
  const filter = builders[0].filters[0];
  assert.match(filter.sql, /user\.name/);
  assert.match(filter.sql, /user\.email/);
  assert.ok(filter.sql.includes(':search'));
  assert.equal(filter.params.search, '%_Ejemplo');
  assert.ok(!filter.sql.includes('%_Ejemplo'));
});

test('combina filtros de rol y estado y aplica paginación estable', async () => {
  const { service, builders } = createHarness({ total: 45 });
  const result = await service.findAllAdmin({
    search: 'cuenta',
    role: 'manager',
    status: 'inactive',
    page: 2,
    pageSize: 20,
  });
  const builder = builders[0];
  assert.equal(builder.filters.length, 3);
  assert.deepEqual(builder.filters[1].params, { role: 'manager' });
  assert.deepEqual(builder.filters[2].params, { status: 'inactive' });
  assert.equal(builder.offset, 20);
  assert.equal(builder.limit, 20);
  assert.deepEqual(builder.orders, [
    { column: 'user.createdAt', direction: 'DESC' },
    { column: 'user.id', direction: 'ASC' },
  ]);
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 20,
    total: 45,
    totalPages: 3,
  });
});

test('conserva data, soporta página vacía y no ejecuta escrituras', async () => {
  const { service, getWrites } = createHarness({ entities: [], raw: [], total: 0 });
  const result = await service.findAllAdmin({ page: 3, pageSize: 20 });
  assert.deepEqual(result.data, []);
  assert.deepEqual(result.pagination, {
    page: 3,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  assert.equal(getWrites(), 0);
});

test('la respuesta no expone contraseña, perfil ni preferencias', async () => {
  const { service, builders } = createHarness();
  const result = await service.findAllAdmin({ page: 1, pageSize: 20 });
  assert.equal(result.data.length, 1);
  assert.equal('password' in result.data[0], false);
  assert.equal('profile' in result.data[0], false);
  assert.equal('preferences' in result.data[0], false);
  assert.ok(!builders[0].selected.some((column) => column.includes('password')));
  assert.ok(!builders[0].selected.some((column) => column.includes('Encrypted')));
});

test('el controlador conserva el contrato principal data', async () => {
  const expected = { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
  const controller = new UsersController({ findAllAdmin: async () => expected });
  assert.deepEqual(await controller.findAll({ page: 1, pageSize: 20 }), expected);
});
