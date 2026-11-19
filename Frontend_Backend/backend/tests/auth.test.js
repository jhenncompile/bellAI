// HU-01: registro, inicio de sesión y aislamiento entre cuentas.
// Ejecutar con: npm run build && node --test tests/auth.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { UsersController } = require('../dist/modules/users/users.controller');
const { resolveJwtSecret } = require('../dist/config/jwt.config');

function createUserRepo() {
  const store = [];
  let seq = 1;
  const matches = (u, where) => Object.entries(where).every(([k, v]) => u[k] === v);
  return {
    store,
    create: (data) => ({ id: `u-${seq++}`, status: 'active', ...data }),
    save: async (u) => {
      const i = store.findIndex((x) => x.id === u.id);
      if (i >= 0) store[i] = u;
      else store.push(u);
      return u;
    },
    findOne: async ({ where }) => store.find((u) => matches(u, where)) || null,
    // login() usa un query builder con addSelect('user.password')
    createQueryBuilder: () => {
      let email;
      const qb = {
        addSelect: () => qb,
        leftJoinAndSelect: () => qb,
        where: (_sql, params) => {
          email = params.email;
          return qb;
        },
        getOne: async () => store.find((u) => u.email === email) || null,
      };
      return qb;
    },
  };
}

const simpleRepo = () => ({ create: (d) => d, save: async (d) => d });

function createService() {
  const users = createUserRepo();
  const jwt = new JwtService({ secret: 'secreto_de_prueba_hu01_suficientemente_largo' });
  return { users, jwt, service: new AuthService(users, simpleRepo(), simpleRepo(), jwt) };
}

test('registro con nombre, correo y contraseña crea una cuenta de usuaria y devuelve token', async () => {
  const { service, jwt, users } = createService();
  const res = await service.register({
    name: '  Ana Pérez ',
    email: 'Ana@Correo.com',
    password: 'secreta123',
  });
  assert.equal(res.user.name, 'Ana Pérez');
  assert.equal(res.user.email, 'ana@correo.com');
  assert.equal(res.user.role, 'user');
  assert.equal(jwt.verify(res.token).sub, res.user.id);
  // La contraseña se guarda cifrada, nunca en claro
  assert.notEqual(users.store[0].password, 'secreta123');
});

test('el registro público ignora un rol elevado enviado por el cliente', async () => {
  const { service } = createService();
  const res = await service.register({
    name: 'Intrusa',
    email: 'x@correo.com',
    password: 'secreta123',
    role: 'admin',
  });
  assert.equal(res.user.role, 'user');
});

test('registrar un correo ya usado informa el motivo', async () => {
  const { service } = createService();
  await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'secreta123' });
  await assert.rejects(
    service.register({ name: 'Otra', email: 'ANA@correo.com', password: 'otra12345' }),
    (err) => err.status === 409 && /correo/i.test(err.message),
  );
});

test('correo inexistente y contraseña errónea dan el mismo mensaje (no revela cuentas)', async () => {
  const { service } = createService();
  await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'secreta123' });

  const noUser = await service.login({ email: 'nadie@correo.com', password: 'secreta123' }).catch((e) => e);
  const badPass = await service.login({ email: 'ana@correo.com', password: 'incorrecta' }).catch((e) => e);
  assert.equal(noUser.status, 401);
  assert.equal(badPass.status, 401);
  assert.equal(noUser.message, badPass.message);
});

test('una cuenta suspendida sólo se informa tras una contraseña correcta', async () => {
  const { service, users } = createService();
  await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'secreta123' });
  users.store[0].status = 'suspended';

  const wrong = await service.login({ email: 'ana@correo.com', password: 'incorrecta' }).catch((e) => e);
  assert.doesNotMatch(wrong.message, /suspendida/);

  const right = await service.login({ email: 'ana@correo.com', password: 'secreta123' }).catch((e) => e);
  assert.equal(right.status, 401);
  assert.match(right.message, /suspendida/);
});

test('inicio de sesión correcto devuelve un token de esa misma usuaria', async () => {
  const { service, jwt } = createService();
  const reg = await service.register({ name: 'Ana', email: 'ana@correo.com', password: 'secreta123' });
  const res = await service.login({ email: ' ANA@correo.com ', password: 'secreta123' });
  assert.equal(res.user.id, reg.user.id);
  assert.equal(jwt.verify(res.token).sub, reg.user.id);
});

test('una usuaria normal o un manager no pueden listar ni consultar otras cuentas (TEC-03: admin)', () => {
  const rolesOf = (method) => Reflect.getMetadata('roles', UsersController.prototype[method]);
  assert.deepEqual(rolesOf('findAll'), ['admin']);
  assert.deepEqual(rolesOf('findOne'), ['admin']);
});

test('sin JWT_SECRET no se usa ningún secreto fijo del código', () => {
  const a = resolveJwtSecret(undefined);
  assert.ok(a.length >= 32);
  assert.notEqual(a, 'super_secreta_jwt_clave_bellia_2026_segura_enterprise');
  assert.equal(resolveJwtSecret('un_secreto_configurado_123'), 'un_secreto_configurado_123');

  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => resolveJwtSecret(undefined), /JWT_SECRET/);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
