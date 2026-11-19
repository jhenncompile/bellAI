// TEC-03: Alinear endpoints de usuarios, filtros y roles (HU-29 / RNF-01)
// Ejecutar con: npm run build && node --test tests/users.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const { UsersController } = require('../dist/modules/users/users.controller');
const { UsersService } = require('../dist/modules/users/users.service');

function createMockUsersService() {
  const users = [
    {
      id: 'usr-1',
      name: 'Valeria Administradora',
      email: 'valeria@bellia.com',
      role: 'admin',
      status: 'active',
      profile: { avatarUrl: 'avatar1.png' },
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'usr-2',
      name: 'Carlos Manager',
      email: 'carlos@bellia.com',
      role: 'manager',
      status: 'active',
      profile: { avatarUrl: 'avatar2.png' },
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 'usr-3',
      name: 'Maria Usuaria',
      email: 'maria@gmail.com',
      role: 'user',
      status: 'inactive',
      profile: { avatarUrl: 'avatar3.png' },
      createdAt: new Date('2026-01-03'),
    },
  ];

  const userRepo = {
    createQueryBuilder: () => {
      let conditions = [];
      let params = {};
      const qb = {
        leftJoinAndSelect: () => qb,
        orderBy: () => qb,
        andWhere: (cond, p) => {
          conditions.push(cond);
          if (p) params = { ...params, ...p };
          return qb;
        },
        getMany: async () => {
          return users.filter((u) => {
            if (params.term) {
              const term = params.term.replaceAll('%', '').toLowerCase();
              const match =
                u.name.toLowerCase().includes(term) ||
                u.email.toLowerCase().includes(term);
              if (!match) return false;
            }
            if (params.role && u.role !== params.role) {
              return false;
            }
            if (params.status && u.status !== params.status) {
              return false;
            }
            return true;
          });
        },
      };
      return qb;
    },
    create: (d) => ({ id: `usr-${Date.now()}`, ...d }),
    save: async (u) => u,
    findOne: async ({ where }) => users.find((u) => u.id === where?.id || u.email === where?.email) || null,
    delete: async (id) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) users.splice(idx, 1);
      return { affected: 1 };
    },
  };

  const simpleRepo = () => ({
    create: (d) => d,
    save: async (d) => d,
  });

  const settingsService = {
    getBoolean: async (key) => key === 'user_creation_enabled',
  };

  const service = new UsersService(
    userRepo,
    simpleRepo(),
    simpleRepo(),
    simpleRepo(),
    settingsService
  );

  return { service, users };
}

test('TEC-03: GET /api/usuarios solo tiene permitido el rol admin', () => {
  const roles = Reflect.getMetadata('roles', UsersController.prototype.findAll);
  assert.deepEqual(roles, ['admin'], 'findAll debe permitir exclusivamente el rol admin');
});

test('TEC-03: POST /api/usuarios solo tiene permitido el rol admin', () => {
  const roles = Reflect.getMetadata('roles', UsersController.prototype.create);
  assert.deepEqual(roles, ['admin'], 'create debe permitir exclusivamente el rol admin');
});

test('TEC-03: DELETE /api/usuarios/:id solo tiene permitido el rol admin', () => {
  const roles = Reflect.getMetadata('roles', UsersController.prototype.delete);
  assert.deepEqual(roles, ['admin'], 'delete debe permitir exclusivamente el rol admin');
});

test('TEC-03: findAll aplica filtro search por nombre o email', async () => {
  const { service } = createMockUsersService();
  const res = await service.findAll({ search: 'valeria' });
  assert.equal(res.length, 1);
  assert.equal(res[0].email, 'valeria@bellia.com');
});

test('TEC-03: findAll aplica filtro por role', async () => {
  const { service } = createMockUsersService();
  const res = await service.findAll({ role: 'manager' });
  assert.equal(res.length, 1);
  assert.equal(res[0].role, 'manager');
});

test('TEC-03: findAll con role "all" devuelve todos los usuarios', async () => {
  const { service } = createMockUsersService();
  const res = await service.findAll({ role: 'all' });
  assert.equal(res.length, 3);
});

test('TEC-03: create crea usuario con perfil y preferencias iniciales', async () => {
  const { service } = createMockUsersService();
  const created = await service.create({
    name: 'Nuevo Usuario',
    email: 'nuevo@bellia.com',
    role: 'user',
  }, 'usr-1');
  assert.equal(created.email, 'nuevo@bellia.com');
  assert.equal(created.role, 'user');
});

test('TEC-03: delete no permite que un admin elimine su propia cuenta', async () => {
  const { service } = createMockUsersService();
  await assert.rejects(
    async () => {
      await service.delete('usr-1', 'usr-1');
    },
    { message: 'No puedes eliminar tu propia cuenta de administrador' }
  );
});

test('TEC-03: delete elimina a un usuario correctamente', async () => {
  const { service } = createMockUsersService();
  const res = await service.delete('usr-3', 'usr-1');
  assert.equal(res.success, true);
});

