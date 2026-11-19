import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getAdminAccessDecision } from '../utils/admin-access.ts';

const admin = { id: '1', name: 'Admin', email: 'admin@bellia.test', role: 'admin' };
const user = { ...admin, role: 'user' };
const manager = { ...admin, role: 'manager' };
const validatedSession = {
  isHydrated: true,
  isAuthenticated: true,
  hasToken: true,
  isValidating: false,
};

test('permite el acceso después de validar un administrador activo', () => {
  assert.equal(getAdminAccessDecision({ ...validatedSession, validatedUser: admin }), 'allowed');
});

test('deniega usuarios normales y managers', () => {
  assert.equal(getAdminAccessDecision({ ...validatedSession, validatedUser: user }), 'denied');
  assert.equal(getAdminAccessDecision({ ...validatedSession, validatedUser: manager }), 'denied');
});

test('redirige al login cuando no existe sesión o token', () => {
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, isAuthenticated: false, validatedUser: admin }),
    'login',
  );
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, hasToken: false, validatedUser: admin }),
    'login',
  );
});

test('un token expirado o rechazado no concede acceso', () => {
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, validationErrorStatus: 401, validationFailed: true }),
    'login',
  );
});

test('un rol desconocido o una validación fallida se deniegan de forma segura', () => {
  assert.equal(
    getAdminAccessDecision({
      ...validatedSession,
      validatedUser: { ...admin, role: 'unknown' },
    }),
    'denied',
  );
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, validationFailed: true }),
    'denied',
  );
});

test('durante hidratación o revalidación no muestra contenido administrativo', () => {
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, isHydrated: false, validatedUser: admin }),
    'loading',
  );
  assert.equal(
    getAdminAccessDecision({ ...validatedSession, isValidating: true, validatedUser: admin }),
    'loading',
  );
});

test('sólo envuelve las cuatro rutas administrativas confirmadas', async () => {
  const routes = await readFile(
    new URL('../../../app/routes/AppRoutes.tsx', import.meta.url),
    'utf8',
  );
  for (const path of ['/dashboard', '/users', '/settings', '/audit-logs']) {
    const routeStart = routes.indexOf(`path="${path}"`);
    assert.notEqual(routeStart, -1);
    assert.match(routes.slice(routeStart, routeStart + 180), /<AdminRoute>/);
  }
  for (const path of ['/login', '/media', '/profile', '/preferences', '/privacy']) {
    const routeStart = routes.indexOf(`path="${path}"`);
    assert.notEqual(routeStart, -1);
    const routeLine = routes.slice(routeStart, routes.indexOf('\n', routeStart));
    assert.doesNotMatch(routeLine, /<AdminRoute>/);
  }
});

test('revalida la sesión mediante el servicio existente antes de renderizar', async () => {
  const guard = await readFile(
    new URL('../components/AdminRoute.tsx', import.meta.url),
    'utf8',
  );
  assert.match(guard, /queryFn: authService\.getProfile/);
  assert.match(guard, /sessionQuery\.isFetching/);
  assert.match(guard, /<Navigate to="\/login"/);
  assert.doesNotMatch(guard, /localStorage/);
});
