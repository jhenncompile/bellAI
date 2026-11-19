/** Estado de un servicio, según una comprobación real hecha al consultar el panel. */
export type ServiceState = 'available' | 'degraded' | 'unavailable';

export interface AnalysisServiceItem {
  name: string;
  status: ServiceState;
  label: string;
  details: string;
  latencyMs?: number | null;
  provider?: string;
}

export type AnalysisServiceKey = 'vision' | 'analysisQueue' | 'virtualAdvisor' | 'recommendations';

export interface PhotoBucket {
  count: number;
  bytes: number;
  formatted: string;
}

export interface DashboardMetrics {
  users: {
    total: number;
    byStatus: { active: number; inactive: number; suspended: number };
    byRole: { admin: number; manager: number; user: number };
    createdLast7Days: number;
    regularUsers?: {
      total: number;
      /** Cuentas habilitadas (estado «activa»), tengan o no actividad */
      active: number;
      inactive: number;
      suspended: number;
      createdLast7Days: number;
    };
    /** HU-30: usuarias con actividad real (inicio de sesión o uso de la app) */
    activity?: {
      activeLast7Days: number;
      activeLast30Days: number;
      neverActive: number;
      lastActivityAt: string | null;
    };
  };
  audit: {
    totalEvents: number;
    eventsLast7Days: number;
    lastEventAt: string | null;
  };
  platform: {
    maintenanceMode: boolean;
    userCreationEnabled: boolean;
  };
  analysisServices?: {
    allOperational: boolean;
    operationalCount: number;
    degradedCount: number;
    unavailableCount: number;
    totalServices: number;
    lastCheckedAt: string;
    services: Record<AnalysisServiceKey, AnalysisServiceItem>;
  };
  storage?: {
    totalStorageBytes: number;
    totalStorageFormatted: string;
    photosCount: number;
    photosStorageBytes: number;
    photosStorageFormatted: string;
    breakdown: {
      wardrobePhotos: PhotoBucket;
      analysisPhotos: PhotoBucket;
      avatarPhotos: PhotoBucket;
      otherMedia: PhotoBucket;
    };
    quotaGb: number | null;
    usagePercent: number | null;
    storageDriver: string;
    measuredAt: string;
  };
  generatedAt: string;
}
