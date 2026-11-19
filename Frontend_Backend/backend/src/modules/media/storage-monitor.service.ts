import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import { AdminAuditService } from '../admin/audit/audit.service';

export const STORAGE_ALERT_RATIO = 0.9;
const ALERT_TITLE = 'Almacenamiento por encima del 90 %';

export interface OrphanFile {
  path: string;
  sizeBytes: number;
  reason: string;
}

/**
 * HU-033: supervisión del almacenamiento multimedia.
 * - CP-033-01/03: uso frente a la cuota configurable y alerta al administrador por encima del 90 %
 *   (una incidencia de prioridad alta, sin duplicarla mientras siga abierta).
 * - CP-033-04: detección y limpieza de archivos huérfanos (sin ninguna referencia en la base).
 */
@Injectable()
export class StorageMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageMonitorService.name);
  private readonly root = path.join(process.cwd(), 'uploads');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly ds: DataSource,
    private readonly settings: PlatformSettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  onModuleInit() {
    // Revisión periódica (cada hora) además de la que se hace al consultar el panel
    this.timer = setInterval(() => void this.usage().catch(() => undefined), 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private walk(dir: string, out: { file: string; size: number }[] = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) this.walk(full, out);
      else if (entry.isFile()) out.push({ file: full, size: fs.statSync(full).size });
    }
    return out;
  }

  /** Uso actual frente a la cuota; crea la alerta si supera el umbral. */
  async usage() {
    const files = this.walk(this.root);
    const [{ db }] = await this.ds.query(`SELECT COALESCE(SUM(size_bytes),0)::bigint AS db FROM media_assets`);
    const localBytes = files.reduce((a, f) => a + f.size, 0);
    // Con S3 los archivos no están en disco: se usa lo registrado en media_assets
    const usedBytes = Math.max(localBytes, Number(db));
    const quotaGb = await this.settings.getNumber('storage_quota_gb');
    const quotaBytes = quotaGb * 1024 ** 3;
    const ratio = quotaBytes ? usedBytes / quotaBytes : 0;
    const alert = ratio >= STORAGE_ALERT_RATIO;
    if (alert) await this.raiseAlert(ratio, usedBytes, quotaGb);
    return {
      usedBytes,
      usedFormatted: `${(usedBytes / 1024 ** 2).toFixed(2)} MB`,
      fileCount: files.length,
      quotaGb,
      usagePercent: Math.round(ratio * 1000) / 10,
      alert,
      alertThresholdPercent: STORAGE_ALERT_RATIO * 100,
    };
  }

  private async raiseAlert(ratio: number, usedBytes: number, quotaGb: number) {
    const open = await this.ds.query(
      `SELECT id FROM incidencia WHERE titulo = $1 AND estado IN ('abierta','en_proceso') LIMIT 1`,
      [ALERT_TITLE],
    );
    if (open.length) return;
    const pct = Math.round(ratio * 1000) / 10;
    await this.ds.query(
      `INSERT INTO incidencia (usuario_id, tipo, titulo, descripcion, prioridad, contexto) VALUES (NULL, 'error', $1, $2, 'alta', $3::jsonb)`,
      [ALERT_TITLE, `El almacenamiento está al ${pct} % de la cuota (${(usedBytes / 1024 ** 3).toFixed(2)} GB de ${quotaGb} GB). Revisa los recursos o ejecuta la limpieza de huérfanos.`, JSON.stringify({ origen: 'monitor_almacenamiento', usagePercent: pct })],
    );
    await this.audit.record({ actorUserId: null, action: 'STORAGE_ALERT', entityType: 'almacenamiento', changes: { usagePercent: pct, quotaGb } });
    this.logger.warn(`Alerta de almacenamiento: ${pct} % de ${quotaGb} GB`);
  }

  /** CP-033-04: archivos en disco que ninguna tabla referencia. */
  async findOrphans(): Promise<OrphanFile[]> {
    const rel = (f: string) => '/' + path.relative(process.cwd(), f).split(path.sep).join('/');
    const wardrobe = await this.ds.query(`SELECT original_image_url AS a, enhanced_image_url AS b FROM wardrobe_items`);
    const wardrobeRefs = new Set<string>(wardrobe.flatMap((r: any) => [r.a, r.b]).filter(Boolean).map((u: string) => u.split('?')[0]));
    const photos = await this.ds.query(`SELECT clave_archivo AS k FROM fotografia`);
    const photoRefs = new Set<string>(photos.map((r: any) => `/uploads/${r.k}`));
    const media = await this.ds.query(`SELECT s3_key AS k FROM media_assets`);
    const mediaRefs = new Set<string>(media.map((r: any) => `/uploads/${String(r.k).replace(/^\/+/, '')}`));
    const avatars = await this.ds.query(`SELECT avatar_url AS u FROM profiles WHERE avatar_url IS NOT NULL`);
    const avatarRefs = new Set<string>(avatars.map((r: any) => {
      const u = String(r.u);
      const i = u.indexOf('/uploads/');
      return i >= 0 ? u.slice(i).split('?')[0] : u;
    }));

    const orphans: OrphanFile[] = [];
    for (const { file, size } of this.walk(this.root)) {
      const p = rel(file);
      // Archivos recientes (menos de 1 h) pueden pertenecer a una subida en curso
      if (Date.now() - fs.statSync(file).mtimeMs < 60 * 60 * 1000) continue;
      let referenced: boolean;
      if (p.startsWith('/uploads/wardrobe/')) referenced = wardrobeRefs.has(p);
      else if (p.startsWith('/uploads/private/')) referenced = photoRefs.has(p);
      else if (p.startsWith('/uploads/avatars/')) referenced = avatarRefs.has(p) || mediaRefs.has(p);
      else referenced = mediaRefs.has(p) || avatarRefs.has(p);
      if (!referenced) orphans.push({ path: p, sizeBytes: size, reason: 'Sin referencia en la base de datos' });
    }
    return orphans;
  }

  async cleanupOrphans(dryRun: boolean, actorId: string) {
    const orphans = await this.findOrphans();
    let freedBytes = 0;
    if (!dryRun) {
      for (const o of orphans) {
        try {
          fs.unlinkSync(path.join(process.cwd(), o.path));
          freedBytes += o.sizeBytes;
        } catch (err: any) {
          this.logger.warn(`No se pudo borrar ${o.path}: ${err?.message}`);
        }
      }
      await this.audit.record({ actorUserId: actorId, action: 'STORAGE_ORPHANS_CLEANED', entityType: 'almacenamiento', changes: { files: orphans.length, freedBytes } });
    }
    return {
      dryRun,
      orphanCount: orphans.length,
      orphanBytes: orphans.reduce((a, o) => a + o.sizeBytes, 0),
      freedBytes,
      files: orphans.slice(0, 200),
    };
  }
}
