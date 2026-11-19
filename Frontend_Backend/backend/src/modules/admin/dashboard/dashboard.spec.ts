import { advisorStatus, classifyUpload, databaseStatus, formatBytes, isPhotoFile, queueStatus, summarizeServices, visionStatus } from './dashboard.metrics';
import { LAST_SEEN_THROTTLE_MS, shouldTouch } from '../../../common/activity/last-seen';

describe('Panel de administración (HU-30)', () => {
  describe('servicios de análisis: el estado sale de una comprobación real', () => {
    it('visión: caída, completa o con modelos que faltan', () => {
      expect(visionStatus(null, null)).toMatchObject({ status: 'unavailable', label: 'No disponible' });
      const ok = visionStatus({ status: 'healthy', device: 'CPU', models: { face: true, pose: true } }, 42);
      expect(ok).toMatchObject({ status: 'available', latencyMs: 42 });
      expect(ok.details).toMatch(/2 modelos/);
      const partial = visionStatus({ status: 'healthy', models: { face: true, clothes_parsing: false, resnet34_imagenet: false } }, 30);
      expect(partial.status).toBe('degraded');
      expect(partial.details).toMatch(/faltan 2 de 3 modelos \(zonas de la ropa, clasificación de prendas\)/);
      // «null» en un modelo es «aún sin cargar», no «falta»
      expect(visionStatus({ status: 'healthy', models: { face: null } }, 10).status).toBe('available');
    });

    it('asesora: sin el modelo de lenguaje sigue con respuestas básicas (con limitaciones, no caída)', () => {
      const llm = { enabled: true, online: true, model: 'qwen2.5:3b', modelInstalled: true };
      expect(advisorStatus(llm, 20).status).toBe('available');
      expect(advisorStatus({ ...llm, online: false }, null)).toMatchObject({ status: 'degraded', label: 'Con limitaciones' });
      expect(advisorStatus({ ...llm, modelInstalled: false }, 15).details).toMatch(/no está descargado/);
      expect(advisorStatus({ ...llm, enabled: false }, null).details).toMatch(/desactivado en Ajustes/);
      expect(advisorStatus(null, null).status).toBe('degraded');
    });

    it('cola: sin Redis no procesa; si fallan más tareas de las que terminan, avisa', () => {
      const base = { driver: 'redis' as const, connected: true, latencyMs: 3, pending: 1, processing: 0, completed24h: 10, failed24h: 1 };
      expect(queueStatus(base).status).toBe('available');
      expect(queueStatus({ ...base, connected: false }).status).toBe('unavailable');
      expect(queueStatus({ ...base, completed24h: 2, failed24h: 5 }).status).toBe('degraded');
      expect(queueStatus({ ...base, driver: 'memoria' }).provider).toMatch(/sin Redis/);
      expect(queueStatus(null).status).toBe('unavailable');
    });

    it('base de datos y resumen', () => {
      expect(databaseStatus(null).status).toBe('unavailable');
      expect(databaseStatus(1500).status).toBe('degraded');
      const sum = summarizeServices({ a: databaseStatus(5), b: databaseStatus(1500), c: databaseStatus(null) });
      expect(sum).toMatchObject({ allOperational: false, operationalCount: 1, degradedCount: 1, unavailableCount: 1, totalServices: 3 });
    });
  });

  describe('fotografías almacenadas', () => {
    it('clasifica por carpeta como la limpieza de huérfanos', () => {
      expect(classifyUpload('uploads/wardrobe/u1/a.webp')).toBe('wardrobe');
      expect(classifyUpload(['uploads', 'private', 'u1', 'rostro.jpg'].join(String.fromCharCode(92)))).toBe('analysis');
      expect(classifyUpload('/uploads/avatars/u1.png')).toBe('avatar');
      expect(classifyUpload('uploads/otros/banner.png')).toBe('other');
    });

    it('solo cuenta fotos, no otros archivos', () => {
      expect(isPhotoFile('a.WEBP')).toBe(true);
      expect(isPhotoFile('modelo.onnx')).toBe(false);
      expect(isPhotoFile('icono.svg')).toBe(false);
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(5 * 1024 ** 2)).toBe('5.00 MB');
    });
  });

  it('la actividad se escribe como mucho cada 5 minutos por cuenta (o siempre al iniciar sesión)', () => {
    const t0 = 1_000_000;
    expect(shouldTouch('u-spec', t0)).toBe(true);
    expect(shouldTouch('u-spec', t0 + 1000)).toBe(false);
    expect(shouldTouch('u-spec', t0 + 1000, true)).toBe(true);
    expect(shouldTouch('u-spec', t0 + 1000 + LAST_SEEN_THROTTLE_MS)).toBe(true);
    expect(shouldTouch('otra-cuenta', t0 + 1000)).toBe(true);
  });
});
