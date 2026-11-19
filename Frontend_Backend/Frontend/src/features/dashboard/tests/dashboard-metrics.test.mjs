// HU-30: reglas de presentación del panel. Ejecutar con: node --test src/features/dashboard/tests/
// (Node 22.6+ importa el .ts directamente quitando los tipos.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { servicesView, storageView, usersView } from '../lib/dashboard-view.ts';

const users = {
  total: 10,
  byStatus: { active: 8, inactive: 1, suspended: 1 },
  byRole: { admin: 2, manager: 1, user: 7 },
  createdLast7Days: 3,
  regularUsers: { total: 7, active: 6, inactive: 1, suspended: 0, createdLast7Days: 2 },
  activity: { activeLast7Days: 2, activeLast30Days: 4, neverActive: 1, lastActivityAt: '2026-11-18T10:00:00.000Z' },
};

test('Criterio 1: activas son las que usaron la app, no las cuentas habilitadas', () => {
  const v = usersView(users);
  assert.equal(v.registered, 7);
  assert.equal(v.active30, 4);
  assert.equal(v.active7, 2);
  assert.equal(v.enabled, 6);
  // Si el servidor no informa la actividad, no se inventa: queda null
  const { activity: _omit, ...withoutActivity } = users;
  assert.equal(usersView(withoutActivity).active30, null);
});

const svc = (status) => ({ name: 'x', status, label: status, details: '' });

test('Criterio 2: el titular refleja el peor estado y cuenta solo los disponibles', () => {
  const all = { allOperational: true, operationalCount: 4, degradedCount: 0, unavailableCount: 0, totalServices: 4, lastCheckedAt: '',
    services: { vision: svc('available'), analysisQueue: svc('available'), virtualAdvisor: svc('available'), recommendations: svc('available') } };
  assert.deepEqual(
    (({ tone, headline, available, total }) => ({ tone, headline, available, total }))(servicesView(all)),
    { tone: 'success', headline: 'Todos disponibles', available: 4, total: 4 },
  );
  const mixed = { ...all, services: { ...all.services, vision: svc('unavailable'), virtualAdvisor: svc('degraded') } };
  const v = servicesView(mixed);
  assert.equal(v.tone, 'destructive');
  assert.equal(v.headline, '1 servicio no disponible');
  assert.equal(v.available, 2);
  assert.deepEqual(v.items.map((i) => i.key), ['vision', 'analysisQueue', 'virtualAdvisor', 'recommendations']);
  // Sin datos no se muestra «4/4»: devuelve null
  assert.equal(servicesView(undefined), null);
});

test('Criterio 3: porcentajes sobre el espacio de las fotos y tono de la cuota', () => {
  const MB = 1024 * 1024;
  const b = (count, mb) => ({ count, bytes: mb * MB, formatted: `${mb} MB` });
  const storage = {
    totalStorageBytes: 20 * MB, totalStorageFormatted: '20 MB', photosCount: 25, photosStorageBytes: 10 * MB, photosStorageFormatted: '10 MB',
    breakdown: { wardrobePhotos: b(18, 7), analysisPhotos: b(2, 1), avatarPhotos: b(5, 2), otherMedia: b(0, 0) },
    quotaGb: 20, usagePercent: 91.5, storageDriver: 'Disco', measuredAt: '',
  };
  const v = storageView(storage);
  assert.deepEqual(v.segments.map((s) => s.percent), [70, 10, 20, 0]);
  assert.equal(v.quotaTone, 'destructive');
  assert.equal(storageView({ ...storage, usagePercent: null }).quotaTone, null);
  assert.equal(storageView({ ...storage, photosStorageBytes: 0 }).segments[0].percent, 0);
});
