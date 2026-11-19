import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { User } from '../../users/entities/user.entity';
import { AuditLog } from '../../privacy/entities/audit-log.entity';
import { PlatformSettingsService } from '../settings/settings.service';
import { LlmService } from '../../assistant/llm.service';
import { TasksService } from '../../tasks/tasks.service';
import { StorageService } from '../../storage/storage.service';
import {
  AnalysisServiceStatus,
  advisorStatus,
  classifyUpload,
  databaseStatus,
  formatBytes,
  isPhotoFile,
  PhotoCategory,
  queueStatus,
  summarizeServices,
  visionStatus,
} from './dashboard.metrics';

export type { AnalysisServiceStatus } from './dashboard.metrics';

/** Tiempo máximo de cada comprobación de servicio: el panel no debe quedarse esperando. */
const CHECK_TIMEOUT_MS = 1500;
/** Recorrer las carpetas de fotos cuesta: el resultado se reutiliza durante un minuto. */
const STORAGE_CACHE_MS = 60 * 1000;

interface PhotoBucket { count: number; bytes: number; formatted: string }

export interface DashboardMetrics {
  users: {
    total: number;
    byStatus: { active: number; inactive: number; suspended: number };
    byRole: { admin: number; manager: number; user: number };
    createdLast7Days: number;
    regularUsers: {
      total: number;
      /** Cuentas habilitadas (estado «activa»), tengan o no actividad */
      active: number;
      inactive: number;
      suspended: number;
      createdLast7Days: number;
    };
    /** HU-30: usuarias (rol «user») con actividad real reciente */
    activity: {
      activeLast7Days: number;
      activeLast30Days: number;
      /** Nunca iniciaron sesión desde que se registra la actividad */
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
  analysisServices: ReturnType<typeof summarizeServices<{
    vision: AnalysisServiceStatus;
    analysisQueue: AnalysisServiceStatus;
    virtualAdvisor: AnalysisServiceStatus;
    recommendations: AnalysisServiceStatus;
  }>>;
  storage: {
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
    /** Cuota configurada en Ajustes y porcentaje usado (todo el almacenamiento, no solo fotos) */
    quotaGb: number | null;
    usagePercent: number | null;
    storageDriver: string;
    measuredAt: string;
  };
  generatedAt: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private storageCache: { at: number; value: DashboardMetrics['storage'] } | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly settingsService: PlatformSettingsService,
    private readonly config: ConfigService,
    private readonly ds: DataSource,
    // Asesora y cola importan AdminModule: se resuelven al vuelo para no crear un ciclo de módulos
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, activeUsers, inactiveUsers, suspendedUsers,
      adminUsers, managerUsers, normalUsers, createdLast7Days,
      regularActiveUsers, regularInactiveUsers, regularSuspendedUsers, regularCreatedLast7Days,
      activity,
      totalEvents, eventsLast7Days, lastEvent,
      maintenanceMode, userCreationEnabled,
      analysisServices, storage,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: 'active' } }),
      this.userRepository.count({ where: { status: 'inactive' } }),
      this.userRepository.count({ where: { status: 'suspended' } }),
      this.userRepository.count({ where: { role: 'admin' } }),
      this.userRepository.count({ where: { role: 'manager' } }),
      this.userRepository.count({ where: { role: 'user' } }),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.userRepository.count({ where: { role: 'user', status: 'active' } }),
      this.userRepository.count({ where: { role: 'user', status: 'inactive' } }),
      this.userRepository.count({ where: { role: 'user', status: 'suspended' } }),
      this.userRepository.count({ where: { role: 'user', createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.userActivity(),
      this.auditRepository.count(),
      this.auditRepository.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.auditRepository.find({ order: { createdAt: 'DESC' }, select: ['createdAt'], take: 1 }).then(([event]) => event ?? null),
      this.settingsService.getBoolean('maintenance_mode'),
      this.settingsService.getBoolean('user_creation_enabled'),
      this.checkAnalysisServices(),
      this.calculateStorageMetrics(),
    ]);

    return {
      users: {
        total: totalUsers,
        byStatus: { active: activeUsers, inactive: inactiveUsers, suspended: suspendedUsers },
        byRole: { admin: adminUsers, manager: managerUsers, user: normalUsers },
        createdLast7Days,
        regularUsers: {
          total: normalUsers,
          active: regularActiveUsers,
          inactive: regularInactiveUsers,
          suspended: regularSuspendedUsers,
          createdLast7Days: regularCreatedLast7Days,
        },
        activity,
      },
      audit: {
        totalEvents,
        eventsLast7Days,
        lastEventAt: lastEvent?.createdAt ? lastEvent.createdAt.toISOString() : null,
      },
      platform: { maintenanceMode, userCreationEnabled },
      analysisServices,
      storage,
      generatedAt: now.toISOString(),
    };
  }

  /** [HU-30: Criterio 1] Usuarias con actividad real (inicio de sesión o uso de la app). */
  private async userActivity(): Promise<DashboardMetrics['users']['activity']> {
    const [row] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::int AS "activeLast7Days",
              COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS "activeLast30Days",
              COUNT(*) FILTER (WHERE last_seen_at IS NULL)::int AS "neverActive",
              MAX(last_seen_at) AS "lastActivityAt"
       FROM users WHERE role = 'user'`,
    );
    return { ...row, lastActivityAt: row.lastActivityAt ? new Date(row.lastActivityAt).toISOString() : null };
  }

  /** [HU-30: Criterio 2] Comprueba en este momento cada servicio del que dependen los análisis. */
  async checkAnalysisServices(): Promise<DashboardMetrics['analysisServices']> {
    const [vision, queue, advisor, recommendations] = await Promise.all([
      this.checkVision(),
      this.checkQueue(),
      this.checkAdvisor(),
      this.checkDatabase(),
    ]);
    return summarizeServices({ vision, analysisQueue: queue, virtualAdvisor: advisor, recommendations });
  }

  private async checkVision(): Promise<AnalysisServiceStatus> {
    const aiBaseUrl =
      this.config.get<string>('AI_SERVICE_URL') ||
      (process.env.NODE_ENV === 'production' ? 'http://ai:8000' : 'http://localhost:8001');
    try {
      const start = Date.now();
      const res = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
      if (!res.ok) return visionStatus(null, null);
      return visionStatus((await res.json()) as any, Date.now() - start);
    } catch {
      return visionStatus(null, null);
    }
  }

  private resolve<T>(token: new (...args: any[]) => T): T | null {
    try {
      return this.moduleRef?.get(token, { strict: false }) ?? null;
    } catch {
      return null;
    }
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS + 500))]);
  }

  private async checkAdvisor(): Promise<AnalysisServiceStatus> {
    const llm = this.resolve(LlmService);
    if (!llm) return advisorStatus(null, null);
    try {
      const start = Date.now();
      const st = await this.withTimeout(llm.status());
      return advisorStatus(st, Date.now() - start);
    } catch {
      return advisorStatus(null, null);
    }
  }

  private async checkQueue(): Promise<AnalysisServiceStatus> {
    const tasks = this.resolve(TasksService);
    if (!tasks) return queueStatus(null);
    try {
      return queueStatus(await this.withTimeout(tasks.health()));
    } catch (err) {
      this.logger.warn(`Estado de la cola no disponible: ${(err as Error).message}`);
      return queueStatus(null);
    }
  }

  private async checkDatabase(): Promise<AnalysisServiceStatus> {
    try {
      const start = Date.now();
      await this.withTimeout(this.ds.query('SELECT 1'));
      return databaseStatus(Date.now() - start);
    } catch {
      return databaseStatus(null);
    }
  }

  /**
   * [HU-30: Criterio 3] Espacio real que ocupan las fotografías.
   * En disco se recorre `uploads/` (sin bloquear el servidor); con S3 se usa lo registrado en
   * `media_assets`. Se reutiliza un minuto para que «Actualizar» no recorra todo cada vez.
   */
  async calculateStorageMetrics(force = false): Promise<DashboardMetrics['storage']> {
    if (!force && this.storageCache && Date.now() - this.storageCache.at < STORAGE_CACHE_MS) return this.storageCache.value;

    const buckets: Record<PhotoCategory, { count: number; bytes: number }> = {
      wardrobe: { count: 0, bytes: 0 }, analysis: { count: 0, bytes: 0 }, avatar: { count: 0, bytes: 0 }, other: { count: 0, bytes: 0 },
    };
    let totalBytes = 0;
    // Con credenciales pero sin S3 alcanzable, StorageService guarda en disco: se informa lo que de verdad usa
    const storageService = this.resolve(StorageService);
    const s3 = storageService ? storageService.usingS3 : Boolean(this.config.get<string>('S3_ACCESS_KEY'));

    // Las fotos de armario, análisis y avatares se guardan en disco aunque haya S3 configurado:
    // siempre se mide el disco, y de S3 se suma lo registrado en `media_assets`.
    if (s3) {
      const rows = await this.ds.query(
        `SELECT media_type AS type, mime_type LIKE 'image/%' AS photo, COUNT(*)::int AS count, COALESCE(SUM(size_bytes), 0)::bigint AS bytes
         FROM media_assets GROUP BY media_type, mime_type LIKE 'image/%'`,
      ).catch(() => []);
      for (const r of rows) {
        totalBytes += Number(r.bytes);
        // Modelos 3D y de IA ocupan espacio, pero no son fotografías
        if (!r.photo) continue;
        const cat: PhotoCategory = r.type === 'garment' ? 'wardrobe' : r.type === 'avatar' ? 'avatar' : r.type === 'photo' ? 'analysis' : 'other';
        buckets[cat].count += Number(r.count);
        buckets[cat].bytes += Number(r.bytes);
      }
    }
    {
      const root = path.join(process.cwd(), 'uploads');
      const walk = async (dir: string): Promise<void> => {
        let entries: import('fs').Dirent[];
        try {
          entries = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
          return; // carpeta inexistente o sin permisos
        }
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.isFile()) {
            try {
              const { size } = await fsp.stat(full);
              totalBytes += size;
              if (!isPhotoFile(entry.name)) continue;
              const cat = classifyUpload(path.relative(process.cwd(), full));
              buckets[cat].count += 1;
              buckets[cat].bytes += size;
            } catch {
              // archivo borrado mientras se recorría
            }
          }
        }
      };
      await walk(root);
    }

    const photoBytes = buckets.wardrobe.bytes + buckets.analysis.bytes + buckets.avatar.bytes + buckets.other.bytes;
    const photoCount = buckets.wardrobe.count + buckets.analysis.count + buckets.avatar.count + buckets.other.count;
    const quotaGb = await this.settingsService.getNumber('storage_quota_gb').catch(() => null);
    const bucket = (b: { count: number; bytes: number }): PhotoBucket => ({ ...b, formatted: formatBytes(b.bytes) });

    const value: DashboardMetrics['storage'] = {
      totalStorageBytes: totalBytes,
      totalStorageFormatted: formatBytes(totalBytes),
      photosCount: photoCount,
      photosStorageBytes: photoBytes,
      photosStorageFormatted: formatBytes(photoBytes),
      breakdown: {
        wardrobePhotos: bucket(buckets.wardrobe),
        analysisPhotos: bucket(buckets.analysis),
        avatarPhotos: bucket(buckets.avatar),
        otherMedia: bucket(buckets.other),
      },
      quotaGb: quotaGb && quotaGb > 0 ? quotaGb : null,
      usagePercent: quotaGb && quotaGb > 0 ? Math.round((totalBytes / (quotaGb * 1024 ** 3)) * 1000) / 10 : null,
      storageDriver: s3
        ? `Disco del servidor (uploads/) y Amazon S3 (${this.config.get<string>('S3_BUCKET') || 'bellia-media'})`
        : 'Disco del servidor (uploads/)',
      measuredAt: new Date().toISOString(),
    };
    this.storageCache = { at: Date.now(), value };
    return value;
  }

  formatBytes(bytes: number): string {
    return formatBytes(bytes);
  }
}
