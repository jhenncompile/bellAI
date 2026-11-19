'use strict';

require('reflect-metadata');
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { DashboardController } = require('../src/modules/admin/dashboard/dashboard.controller');
const { DashboardService } = require('../src/modules/admin/dashboard/dashboard.service');
const { JwtAuthGuard } = require('../src/common/guards/jwt-auth.guard');
const { RolesGuard } = require('../src/common/guards/roles.guard');
const { ROLES_KEY } = require('../src/common/decorators/roles.decorator');

function createMockUserRepository(users = []) {
  return {
    async count(options) {
      if (!options || !options.where) return users.length;
      const where = options.where;
      return users.filter((u) => {
        if (where.status && u.status !== where.status) return false;
        if (where.role && u.role !== where.role) return false;
        return true;
      }).length;
    },
  };
}

function createMockAuditRepository(logs = []) {
  return {
    async count() {
      return logs.length;
    },
    async find() {
      return logs.slice(0, 1);
    },
  };
}

function createMockSettingsService() {
  return {
    async getBoolean(key) {
      if (key === 'maintenance_mode') return false;
      if (key === 'user_creation_enabled') return true;
      return false;
    },
    async getNumber(key) {
      return key === 'storage_quota_gb' ? 20 : 0;
    },
  };
}

/** Base de datos simulada: actividad de usuarias y el «SELECT 1» de la comprobación. */
function createMockDataSource({ activity, failDb = false, media = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes('last_seen_at')) return [activity || { activeLast7Days: 0, activeLast30Days: 0, neverActive: 0, lastActivityAt: null }];
      if (sql.trim() === 'SELECT 1') {
        if (failDb) throw new Error('sin conexión');
        return [{ '?column?': 1 }];
      }
      if (sql.includes('media_assets')) return media;
      return [];
    },
  };
}

const newService = ({ users = [], env = {}, ds, moduleRef } = {}) =>
  new DashboardService(
    createMockUserRepository(users),
    createMockAuditRepository([]),
    createMockSettingsService(),
    createMockConfigService(env),
    ds || createMockDataSource(),
    moduleRef,
  );

function createMockConfigService(env = {}) {
  return {
    get(key, defaultValue = undefined) {
      return env[key] !== undefined ? env[key] : defaultValue;
    },
  };
}

test('HU-30: el controlador de dashboard requiere JWT y rol admin/manager', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController);
  assert.ok(guards, 'Debe tener guards declarados');
  assert.ok(guards.includes(JwtAuthGuard), 'Debe requerir JwtAuthGuard');
  assert.ok(guards.includes(RolesGuard), 'Debe requerir RolesGuard');

  const roles = Reflect.getMetadata(ROLES_KEY, DashboardController);
  assert.deepEqual(roles, ['admin', 'manager'], 'Debe permitir acceso a admin y manager');
});

test('HU-30 Criterio 1: usuarias registradas y activas de verdad (con actividad reciente)', async () => {
  const users = [
    { id: '1', role: 'admin', status: 'active' },
    { id: '2', role: 'manager', status: 'active' },
    { id: '3', role: 'user', status: 'active' },
    { id: '4', role: 'user', status: 'active' },
    { id: '5', role: 'user', status: 'inactive' },
    { id: '6', role: 'user', status: 'suspended' },
  ];
  const activity = { activeLast7Days: 1, activeLast30Days: 2, neverActive: 1, lastActivityAt: '2026-11-18T10:00:00.000Z' };
  const metrics = await newService({ users, ds: createMockDataSource({ activity }) }).getMetrics();

  assert.equal(metrics.users.total, 6);
  assert.equal(metrics.users.regularUsers.total, 4, 'Usuarias registradas');
  assert.equal(metrics.users.regularUsers.active, 2, 'Cuentas habilitadas');
  // «Activas» sale de la actividad real (users.last_seen_at), no del estado de la cuenta
  assert.equal(metrics.users.activity.activeLast30Days, 2);
  assert.equal(metrics.users.activity.activeLast7Days, 1);
  assert.equal(metrics.users.activity.neverActive, 1);
});

test('HU-30 Criterio 2: cada servicio se comprueba de verdad; si no responde, no figura como disponible', async () => {
  const service = newService({ env: { AI_SERVICE_URL: 'http://127.0.0.1:9' } });
  const status = await service.checkAnalysisServices();

  assert.deepEqual(Object.keys(status.services).sort(), ['analysisQueue', 'recommendations', 'virtualAdvisor', 'vision']);
  assert.equal(status.totalServices, 4);
  // Servicio de IA inalcanzable
  assert.equal(status.services.vision.status, 'unavailable');
  // Sin cola ni asesora que consultar (no hay ModuleRef en la prueba): no se dan por buenas
  assert.equal(status.services.analysisQueue.status, 'unavailable');
  assert.equal(status.services.virtualAdvisor.status, 'degraded');
  // La base de datos simulada responde
  assert.equal(status.services.recommendations.status, 'available');
  assert.equal(status.allOperational, false);
  assert.equal(status.operationalCount, 1);
});

test('HU-30 Criterio 2: con la cola y la asesora en marcha, figuran como disponibles', async () => {
  const { LlmService } = require('../src/modules/assistant/llm.service');
  const { TasksService } = require('../src/modules/tasks/tasks.service');
  const fakes = new Map([
    [LlmService, { status: async () => ({ enabled: true, online: true, model: 'qwen2.5:3b', modelInstalled: true }) }],
    [TasksService, { health: async () => ({ driver: 'memoria', connected: true, latencyMs: null, pending: 0, processing: 0, completed24h: 3, failed24h: 0 }) }],
  ]);
  const moduleRef = { get: (token) => fakes.get(token) };
  const status = await newService({ env: { AI_SERVICE_URL: 'http://127.0.0.1:9' }, moduleRef }).checkAnalysisServices();
  assert.equal(status.services.virtualAdvisor.status, 'available');
  assert.equal(status.services.analysisQueue.status, 'available');
  // Con la base caída, recomendaciones y armario no están disponibles
  const down = await newService({ ds: createMockDataSource({ failDb: true }), moduleRef }).checkAnalysisServices();
  assert.equal(down.services.recommendations.status, 'unavailable');
});

test('HU-30 Criterio 3: espacio de las fotografías por tipo y frente a la cuota', async () => {
  // Con S3, de media_assets solo cuentan como fotos las imágenes (los modelos 3D y de IA no)
  const media = [
    { type: 'garment', photo: true, count: 2, bytes: String(1024 * 500) },
    { type: 'ai_component', photo: false, count: 1, bytes: String(1024 * 1024 * 40) },
  ];
  const service = newService({ env: { S3_ACCESS_KEY: 'x', S3_BUCKET: 'bellia-test-bucket' }, ds: createMockDataSource({ media }) });
  const storage = await service.calculateStorageMetrics(true);

  assert.ok(storage.photosCount >= 2);
  assert.ok(storage.breakdown.wardrobePhotos.bytes >= 1024 * 500);
  assert.ok(storage.totalStorageBytes >= 1024 * 500 + 1024 * 1024 * 40, 'El total incluye los modelos');
  assert.ok(storage.photosStorageBytes < storage.totalStorageBytes, 'Las fotos no incluyen los modelos');
  assert.ok(storage.breakdown.analysisPhotos && storage.breakdown.otherMedia);
  assert.equal(storage.quotaGb, 20);
  assert.equal(typeof storage.usagePercent, 'number');
  assert.ok(storage.storageDriver.includes('S3 (bellia-test-bucket)'), storage.storageDriver);
});
