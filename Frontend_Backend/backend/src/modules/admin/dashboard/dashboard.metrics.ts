/**
 * HU-30: reglas puras del panel de administración (se prueban sin base de datos ni servicios).
 * Cada servicio se informa como disponible, con limitaciones (funciona, pero con menos) o no
 * disponible, siempre a partir de una comprobación real hecha en el momento de la consulta.
 */

export type ServiceState = 'available' | 'degraded' | 'unavailable';

export interface AnalysisServiceStatus {
  name: string;
  status: ServiceState;
  label: string;
  details: string;
  latencyMs?: number | null;
  provider?: string;
}

const LABEL: Record<ServiceState, string> = {
  available: 'Disponible',
  degraded: 'Con limitaciones',
  unavailable: 'No disponible',
};

const svc = (name: string, status: ServiceState, details: string, extra: Partial<AnalysisServiceStatus> = {}): AnalysisServiceStatus => ({
  name, status, label: LABEL[status], details, ...extra,
});

/** Nombres legibles de los modelos que informa el servicio de IA en `/health`. */
const MODEL_LABELS: Record<string, string> = {
  face: 'puntos del rostro',
  pose: 'silueta',
  segmenter: 'piel y cabello',
  hands: 'manos',
  garment_segmenter: 'recorte de prendas',
  face_parsing: 'zonas del rostro',
  clothes_parsing: 'zonas de la ropa',
  resnet34_imagenet: 'clasificación de prendas',
};
const modelLabel = (k: string) => MODEL_LABELS[k] ?? k.replace(/_/g, ' ');

/**
 * Visión artificial (servicio FastAPI): `health` es la respuesta de `/health` o null si no respondió.
 * Si responde pero le faltan modelos, funciona con limitaciones y se dice cuáles faltan.
 */
export function visionStatus(health: { status?: string; device?: string; models?: Record<string, boolean | null> } | null, latencyMs: number | null): AnalysisServiceStatus {
  const name = 'Análisis de imagen (IA)';
  if (!health || health.status !== 'healthy') {
    return svc(name, 'unavailable', 'El servicio de análisis no responde: no se pueden analizar rostro, silueta ni prendas.', { latencyMs: null });
  }
  const models = Object.entries(health.models ?? {});
  const missing = models.filter(([, ok]) => ok === false).map(([k]) => modelLabel(k));
  const loaded = models.length - missing.length;
  const device = health.device || 'CPU';
  if (missing.length) {
    return svc(name, 'degraded', `Responde, pero faltan ${missing.length} de ${models.length} modelos (${missing.join(', ')}). Algunos análisis serán menos precisos.`, { latencyMs, provider: device });
  }
  return svc(name, 'available', models.length ? `Responde con ${loaded} modelos cargados (${device}).` : `Responde (${device}).`, { latencyMs, provider: device });
}

/**
 * Asesora virtual: el modelo de lenguaje local (Ollama). Si no está, la asesora sigue con
 * respuestas básicas por reglas, así que no está caída del todo.
 */
export function advisorStatus(
  llm: { enabled: boolean; online: boolean; model: string; modelInstalled: boolean; providerLabel?: string; problem?: string | null } | null,
  latencyMs: number | null,
): AnalysisServiceStatus {
  const name = 'Asesora virtual';
  if (!llm) return svc(name, 'degraded', 'No se pudo comprobar el modelo de lenguaje: responde con respuestas básicas.');
  const provider = `${llm.providerLabel ?? 'Ollama'} · ${llm.model}`;
  const kimi = llm.providerLabel?.startsWith('Kimi');
  if (!llm.enabled) return svc(name, 'degraded', 'El modelo de lenguaje está desactivado en Ajustes: responde con respuestas básicas.', { provider });
  if (!llm.online) return svc(name, 'degraded', `${kimi ? 'La API de Kimi' : 'El modelo de lenguaje'} no responde: la asesora usa respuestas básicas.`, { provider });
  // Clave de Kimi inválida o sin saldo
  if (kimi && llm.problem) return svc(name, 'degraded', `${llm.problem} La asesora usa respuestas básicas.`, { provider, latencyMs });
  if (!llm.modelInstalled) {
    return svc(name, 'degraded', kimi
      ? `Kimi no ofrece el modelo «${llm.model}» con esta clave: revisa «Modelo de Kimi» en Ajustes.`
      : `El modelo «${llm.model}» no está descargado: la asesora usa respuestas básicas.`, { provider, latencyMs });
  }
  // Responde, pero con el modelo local porque falta la clave de Kimi
  if (llm.problem) return svc(name, 'degraded', `${llm.problem} Responde con «${llm.model}».`, { provider, latencyMs });
  return svc(name, 'available', `Responde con el modelo «${llm.model}».`, { provider, latencyMs });
}

/** Cola de análisis (HU-041): conexión con Redis y tareas de las últimas 24 h. */
export function queueStatus(q: { driver: 'redis' | 'memoria'; connected: boolean; latencyMs: number | null; pending: number; processing: number; completed24h: number; failed24h: number } | null): AnalysisServiceStatus {
  const name = 'Cola de análisis';
  if (!q) return svc(name, 'unavailable', 'No se pudo consultar la cola de tareas.');
  const counts = `${q.pending} en espera · ${q.processing} en curso · ${q.failed24h} fallidas en 24 h`;
  if (!q.connected) return svc(name, 'unavailable', `No hay conexión con Redis: los análisis pesados no se procesan. ${counts}.`, { provider: 'Redis' });
  // Más fallidas que completadas en el día indica un problema aunque la cola esté conectada
  const failing = q.failed24h > 0 && q.failed24h >= q.completed24h;
  const provider = q.driver === 'redis' ? 'Redis (BullMQ)' : 'En el servidor (sin Redis)';
  if (failing) return svc(name, 'degraded', `Muchas tareas fallan: ${q.failed24h} fallidas y ${q.completed24h} completadas en 24 h.`, { provider, latencyMs: q.latencyMs });
  return svc(name, 'available', counts + '.', { provider, latencyMs: q.latencyMs });
}

/** Base de datos: de ella dependen recomendaciones, armario e historial. */
export function databaseStatus(latencyMs: number | null): AnalysisServiceStatus {
  const name = 'Recomendaciones y armario';
  if (latencyMs === null) return svc(name, 'unavailable', 'La base de datos no responde: no hay recomendaciones ni armario.', { provider: 'PostgreSQL' });
  if (latencyMs > 1000) return svc(name, 'degraded', `La base de datos responde lento (${latencyMs} ms).`, { provider: 'PostgreSQL', latencyMs });
  return svc(name, 'available', 'Motor de recomendaciones y base de datos respondiendo.', { provider: 'PostgreSQL', latencyMs });
}

export function summarizeServices<T extends Record<string, AnalysisServiceStatus>>(services: T) {
  const list = Object.values(services);
  const operationalCount = list.filter((s) => s.status === 'available').length;
  const degradedCount = list.filter((s) => s.status === 'degraded').length;
  return {
    allOperational: operationalCount === list.length,
    operationalCount,
    degradedCount,
    unavailableCount: list.length - operationalCount - degradedCount,
    totalServices: list.length,
    lastCheckedAt: new Date().toISOString(),
    services,
  };
}

// ---------------------------------------------------------------------------
// Fotografías almacenadas
// ---------------------------------------------------------------------------

export type PhotoCategory = 'wardrobe' | 'analysis' | 'avatar' | 'other';

const PHOTO_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.avif']);

export function isPhotoFile(name: string): boolean {
  const i = name.lastIndexOf('.');
  return i >= 0 && PHOTO_EXT.has(name.slice(i).toLowerCase());
}

/** Categoría por carpeta, la misma división que usa la limpieza de huérfanos (HU-033). */
export function classifyUpload(relPath: string): PhotoCategory {
  const p = relPath.replace(/\\/g, '/').toLowerCase();
  if (p.includes('/wardrobe/')) return 'wardrobe';
  if (p.includes('/private/')) return 'analysis';
  if (p.includes('/avatars/')) return 'avatar';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
