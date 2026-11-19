import { presetFromBodyType } from './avatar.service';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AiFile, AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { TasksService } from '../tasks/tasks.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { BellaiService } from '../bellai/bellai.service';
import { hasPhotoConsent } from '../diagnosis/consent.helper';

export const AVATAR_SCAN_TASK = 'avatar_escaneo';

/** Vistas de la cabeza que pide la app (la de frente es obligatoria). */
export const FACE_FIELDS = ['face_frente', 'face_izquierda', 'face_derecha', 'face_arriba', 'face_abajo'];
export const MAX_TURN_FRAMES = 24;
const MAX_FILE_MB = 8;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

interface ScanInput {
  photos: Record<string, string>; // campo → id de fotografia
  heightCm: number;
}

/** Campos aceptados del multipart: vistas de la cabeza, pose T y fotos del giro (turn_0 … turn_23). */
export function scanField(name: string): boolean {
  if (FACE_FIELDS.includes(name) || name === 'tpose') return true;
  const m = /^turn_(\d{1,2})$/.exec(name);
  return Boolean(m && Number(m[1]) < MAX_TURN_FRAMES);
}

/** Valida estatura y fotos antes de guardar nada. Devuelve las fotos por campo (sin duplicados). */
export function checkScanUpload(files: Express.Multer.File[], height: unknown): { byField: Map<string, Express.Multer.File>; heightCm: number } {
  const heightCm = Number(String(height ?? '').replace(',', '.'));
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 220) throw new BadRequestException('Indica tu estatura en centímetros (entre 120 y 220).');
  const byField = new Map<string, Express.Multer.File>();
  for (const f of files ?? []) {
    if (!scanField(f.fieldname) || byField.has(f.fieldname)) continue;
    if (!ALLOWED.includes(f.mimetype)) throw new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.');
    if (f.size > MAX_FILE_MB * 1024 * 1024) throw new BadRequestException(`Cada foto debe pesar menos de ${MAX_FILE_MB} MB.`);
    byField.set(f.fieldname, f);
  }
  if (!byField.has('face_frente')) throw new BadRequestException('Falta la foto de tu cara de frente.');
  if (!byField.has('tpose')) throw new BadRequestException('Falta la foto de cuerpo entero en pose T.');
  return { byField, heightCm };
}

/**
 * HU-023: avatar 3D a partir del escaneo guiado. El teléfono solo hace las fotos; el servicio de IA
 * mide el cuerpo y arma la malla. Las fotos se borran al terminar (siempre: el avatar no las necesita)
 * y la malla queda privada en el almacenamiento, enlazada en avatar.configuracion.scan.
 */
@Injectable()
export class AvatarScanService implements OnModuleInit {
  private readonly logger = new Logger(AvatarScanService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly ai: AiGatewayService,
    private readonly tasks: TasksService,
    private readonly audit: AdminAuditService,
    private readonly bellai: BellaiService,
  ) {}

  onModuleInit() {
    this.tasks.register(AVATAR_SCAN_TASK, (input: ScanInput, ctx) => this.run(ctx.userId, input, ctx.progress), { minTimeoutS: 240 });
  }

  private async requireConsent(user: User) {
    if (!(await hasPhotoConsent(this.ds, user.id))) {
      throw new ForbiddenException({
        code: 'consentimiento_requerido',
        message: 'Para analizar tus fotos necesitamos tu autorización explícita. Actívala en Privacidad.',
      });
    }
  }

  /**
   * Comprobación rápida durante el escaneo: ¿se ve el cuerpo entero en la foto de la pose T?
   * La foto no se guarda. La app repite la foto con la indicación si no.
   */
  async checkBody(user: User, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Adjunta la foto en el campo "file".');
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.');
    await this.requireConsent(user);
    return this.ai.postImage<{ ok: boolean; code: string | null; message: string; tpose: boolean }>('/api/v1/avatar/check-body', file, {}, 20_000);
  }

  async start(user: User, files: Express.Multer.File[], height: unknown) {
    const { byField, heightCm } = checkScanUpload(files, height);
    await this.requireConsent(user);
    await this.bellai.ensureUser(user);
    const photos: Record<string, string> = {};
    for (const [field, f] of byField) photos[field] = await this.storePhoto(user.id, f);
    const task = await this.tasks.enqueue(user.id, AVATAR_SCAN_TASK, { photos, heightCm } as any);
    await this.audit.record({
      actorUserId: user.id,
      action: 'AVATAR_SCAN_REQUESTED',
      entityType: 'tarea',
      entityId: task.id,
      changes: { photos: byField.size, heightCm },
    });
    return task;
  }

  private async storePhoto(userId: string, f: Express.Multer.File) {
    const ext = f.mimetype === 'image/png' ? 'png' : f.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `private/${userId}/photos/${randomUUID()}.${ext}`;
    await this.storage.uploadFile({ key, buffer: f.buffer, contentType: f.mimetype, cacheControl: 'private, no-store' });
    const [row] = await this.ds.query(
      `INSERT INTO fotografia (usuario_id, tipo, clave_archivo, mime, tamano_bytes) VALUES ($1,'avatar',$2,$3,$4) RETURNING id`,
      [userId, key, f.mimetype, f.size],
    );
    return row.id as string;
  }

  private async discardPhotos(userId: string, ids: string[]) {
    for (const id of ids) {
      const [row] = await this.ds.query('SELECT clave_archivo AS key FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
      if (!row) continue;
      await this.storage.deleteFile(row.key).catch((e) => this.logger.warn(`No se pudo borrar ${row.key}: ${e?.message}`));
      await this.ds.query('DELETE FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
    }
  }

  private async run(userId: string, input: ScanInput, progress: (v: number) => Promise<void>) {
    const ids = Object.values(input.photos ?? {});
    try {
      await progress(5);
      const files: Record<string, AiFile> = {};
      for (const [field, id] of Object.entries(input.photos)) {
        const [row] = await this.ds.query('SELECT clave_archivo AS key, mime FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
        if (!row) throw new NotFoundException('Las fotos del escaneo ya no están disponibles. Repite el escaneo.');
        files[field] = { buffer: await this.storage.readFile(row.key), mimetype: row.mime, originalname: `${field}.jpg` };
      }
      await progress(15);
      const result = await this.ai.postFiles<any>('/api/v1/avatar/reconstruct', files, { height_cm: String(input.heightCm) }, 220_000);
      await progress(85);
      const scan = await this.saveMesh(userId, result);
      await progress(95);
      return { measurements: scan.measurements, appearance: scan.appearance, quality: scan.quality };
    } finally {
      await this.discardPhotos(userId, ids);
    }
  }

  /** Guarda la malla (JSON) en privado y deja en avatar.configuracion.scan las medidas y la clave. */
  private async saveMesh(userId: string, result: any) {
    const key = `private/${userId}/avatar/escaneo-${randomUUID()}.json`;
    await this.storage.uploadFile({ key, buffer: Buffer.from(JSON.stringify(result.mesh)), contentType: 'application/json', cacheControl: 'private, no-store' });
    const scan = {
      key,
      version: result.version,
      measurements: result.measurements,
      proportions: result.proportions,
      appearance: result.appearance,
      // Silueta y ajustes del maniquí calculados a partir de las medidas
      mannequin: result.mannequin ?? null,
      quality: result.quality,
      createdAt: new Date().toISOString(),
    };
    const [prev] = await this.ds.query(`SELECT configuracion->'scan'->>'key' AS key FROM avatar WHERE usuario_id = $1`, [userId]);
    await this.ds.query(
      `INSERT INTO avatar (usuario_id, clave_modelo_3d, configuracion) VALUES ($1,$2,jsonb_build_object('scan',$3::jsonb))
       ON CONFLICT (usuario_id) DO UPDATE SET configuracion = COALESCE(avatar.configuracion,'{}'::jsonb) || jsonb_build_object('scan',$3::jsonb), actualizado_en = CURRENT_TIMESTAMP`,
      [userId, `procedural:${userId}`, JSON.stringify(scan)],
    );
    if (prev?.key && prev.key !== key) await this.storage.deleteFile(prev.key).catch(() => undefined);
    return scan;
  }

  /**
   * Malla 3D del avatar: el maniquí (MakeHuman CC0) generado en la IA con la silueta, el cabello y las prendas.
   * Si hay escaneo, sus medidas fijan la silueta y los ajustes por defecto (la personalización manda).
   */
  async mesh(user: User, garments: { kind: string; color: string }[] = []): Promise<Buffer> {
    const [row] = await this.ds.query(`SELECT configuracion FROM avatar WHERE usuario_id = $1`, [user.id]);
    const fit = (row?.configuracion?.scan?.mannequin as Record<string, any>) || {};

    const [diag] = await this.ds.query(
      `SELECT forma_rostro AS "faceShape", tono_piel AS "skinTone", subtono_piel AS "undertone",
              paleta_estacional AS "seasonalPalette", tipo_cuerpo AS "bodyType", proporciones,
              caracteristicas_cabello AS "hairFeatures", resultado_detallado AS d
       FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1`,
      [user.id],
    );

    const custom = (row?.configuracion?.customization as Record<string, any>) || {};
    const d = diag?.d || {};
    const m = d?.body?.metrics || diag?.proporciones || {};
    const bodyType = custom.bodyType || d?.body?.bodyType || diag?.bodyType || null;

    const payload = {
      complexion: custom.complexion || 'Equilibrada',
      complexionScale: custom.complexionScale ?? 1.0,
      heightScale: custom.heightScale ?? fit.heightScale ?? 1.0,
      skinHex: custom.skinHex || d?.colorimetry?.skinHex || '#C99A7A',
      hairHex: custom.hairHex || d?.hair?.baseColor?.hex || '#3B2A20',
      hairStyle: custom.hairStyle || d?.hair?.texture?.type || 'Liso',
      eyeColorHex: custom.eyeColorHex || d?.colorimetry?.eyes?.hex || '#5D4037',
      bodyType,
      // Maniquí: silueta elegida (o la recomendada por el análisis), cabello y prendas del outfit
      preset: custom.preset ?? fit.preset ?? presetFromBodyType(bodyType) ?? 'reloj',
      hairLength: custom.hairLength ?? 'Medio',
      hairFringe: custom.hairFringe ?? false,
      garments,
      bustScale: custom.bustScale ?? fit.bustScale,
      waistScale: custom.waistScale ?? fit.waistScale,
      hipsScale: custom.hipsScale ?? fit.hipsScale,
      shouldersScale: custom.shouldersScale,
      proportions: m?.hipWidthPx
        ? {
            shoulder: Math.round((m.shoulderWidthPx / m.hipWidthPx) * 100) / 100,
            waist: Math.round((m.waistWidthPx / m.hipWidthPx) * 100) / 100,
            hip: 1.0,
            legToBody: Math.round((m.legToBody ?? 0.58) * 100) / 100,
          }
        : { shoulder: 1.0, waist: 0.75, hip: 1.0, legToBody: 0.58 },
    };

    try {
      const meshData = await this.ai.postJson<Record<string, unknown>>('/api/v1/avatar/base-mesh', payload, 30_000);
      return Buffer.from(JSON.stringify(meshData));
    } catch (err) {
      this.logger.warn(`IA base-mesh no disponible (${err?.message || err}), se usa el maniquí por defecto (baseMeshFemale.json).`);
      const localPaths = [
        path.join(process.cwd(), 'ai/models/humanModel/baseMeshFemale.json'),
        path.join(process.cwd(), 'backend/ai/models/humanModel/baseMeshFemale.json'),
        path.join(__dirname, '../../../../ai/models/humanModel/baseMeshFemale.json'),
      ];
      for (const p of localPaths) {
        if (fs.existsSync(p)) {
          return fs.readFileSync(p);
        }
      }
      throw new NotFoundException('No se pudo generar la malla anatómica del avatar.');
    }
  }

  /** Borra el escaneo (malla y medidas); el avatar vuelve al modelo procedural. */
  async remove(user: User) {
    const [row] = await this.ds.query(`SELECT configuracion->'scan'->>'key' AS key FROM avatar WHERE usuario_id = $1`, [user.id]);
    if (!row?.key) return { deleted: false };
    await this.storage.deleteFile(row.key).catch(() => undefined);
    await this.ds.query(`UPDATE avatar SET configuracion = configuracion - 'scan', actualizado_en = CURRENT_TIMESTAMP WHERE usuario_id = $1`, [user.id]);
    return { deleted: true };
  }
}
