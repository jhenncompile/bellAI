/**
 * HU-30: reglas de presentación del panel, puras y sin React para probarlas con `node --test`.
 * Nunca inventan cifras: si el servidor no envió un dato, devuelven null y la pantalla lo dice.
 */
import type { AnalysisServiceItem, AnalysisServiceKey, DashboardMetrics, ServiceState } from '../types/dashboard.types.ts';

export type Tone = 'success' | 'warning' | 'destructive';

export const STATE_TONE: Record<ServiceState, Tone> = {
  available: 'success',
  degraded: 'warning',
  unavailable: 'destructive',
};

/** Criterio 1: registradas y activas de verdad (con actividad reciente), no solo habilitadas. */
export function usersView(users: DashboardMetrics['users']) {
  const regular = users.regularUsers;
  return {
    registered: regular ? regular.total : users.byRole.user,
    newThisWeek: regular?.createdLast7Days ?? null,
    /** null si el servidor aún no informa actividad (versión anterior de la API) */
    active30: users.activity?.activeLast30Days ?? null,
    active7: users.activity?.activeLast7Days ?? null,
    neverActive: users.activity?.neverActive ?? null,
    enabled: regular ? regular.active : null,
    lastActivityAt: users.activity?.lastActivityAt ?? null,
  };
}

const SERVICE_ORDER: { key: AnalysisServiceKey; category: string }[] = [
  { key: 'vision', category: 'Visión artificial' },
  { key: 'analysisQueue', category: 'Procesamiento' },
  { key: 'virtualAdvisor', category: 'Asistencia virtual' },
  { key: 'recommendations', category: 'Recomendaciones' },
];

/** Criterio 2: servicios en orden fijo, con su tono, y un titular de conjunto. */
export function servicesView(analysis: DashboardMetrics['analysisServices'] | undefined) {
  if (!analysis) return null;
  const items = SERVICE_ORDER
    .filter(({ key }) => analysis.services[key])
    .map(({ key, category }) => ({ key, category, info: analysis.services[key] as AnalysisServiceItem, tone: STATE_TONE[analysis.services[key].status] }));
  const unavailable = items.filter((i) => i.info.status === 'unavailable').length;
  const degraded = items.filter((i) => i.info.status === 'degraded').length;
  const tone: Tone = unavailable ? 'destructive' : degraded ? 'warning' : 'success';
  const headline = unavailable
    ? `${unavailable} ${unavailable === 1 ? 'servicio no disponible' : 'servicios no disponibles'}`
    : degraded
      ? `${degraded} con limitaciones`
      : 'Todos disponibles';
  const available = items.length - unavailable - degraded;
  return { items, tone, headline, available, total: items.length };
}

export const STORAGE_SEGMENTS = [
  { key: 'wardrobePhotos', label: 'Armario' },
  { key: 'analysisPhotos', label: 'Fotos de análisis' },
  { key: 'avatarPhotos', label: 'Avatares' },
  { key: 'otherMedia', label: 'Otras imágenes' },
] as const;

/** Criterio 3: reparto del espacio de las fotos (porcentajes sobre lo que ocupan las fotos). */
export function storageView(storage: DashboardMetrics['storage'] | undefined) {
  if (!storage) return null;
  const photoBytes = storage.photosStorageBytes;
  const segments = STORAGE_SEGMENTS.map(({ key, label }) => {
    const b = storage.breakdown[key];
    return { key, label, ...b, percent: photoBytes > 0 ? Math.round((b.bytes / photoBytes) * 1000) / 10 : 0 };
  });
  const quotaTone: Tone | null = storage.usagePercent === null ? null : storage.usagePercent >= 90 ? 'destructive' : storage.usagePercent >= 75 ? 'warning' : 'success';
  return { segments, quotaTone };
}

/** Clases del tema para cada tono (tokens, sin colores crudos). */
export const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
};

export const TONE_CARD: Record<Tone, string> = {
  success: 'border-border bg-muted/20',
  warning: 'border-warning/40 bg-warning/5',
  destructive: 'border-destructive/40 bg-destructive/5',
};

export const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** Colores de los tramos de la barra de fotos, en el orden de STORAGE_SEGMENTS. */
export const SEGMENT_BAR = ['bg-primary', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4'] as const;
