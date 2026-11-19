import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID, createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { TasksService } from '../tasks/tasks.service';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { BellaiService } from '../bellai/bellai.service';
import { hasPhotoConsent, latestConsent, PHOTO_RETENTION_CONSENT } from './consent.helper';
import { buildIntegratedDiagnosis, FaceAnalysis, BodyAnalysis, mergeAnalyses, toLegacyFaceContract } from './diagnosis.builder';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
export const DIAGNOSIS_TASK = 'diagnostico';

interface DiagnosisInput {
  facePhotoId?: string | null;
  bodyPhotoId?: string | null;
  keepPhotos: boolean;
}

/**
 * Diagnóstico morfológico (HU-002 a HU-006, HU-035, HU-036) orquestado como tarea asíncrona (HU-041).
 * Las fotos se guardan como privadas y, salvo que la usuaria acepte conservarlas
 * (consentimiento photo_retention), se eliminan al terminar el análisis (HU-034).
 */
@Injectable()
export class DiagnosisService implements OnModuleInit {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly storage: StorageService,
    private readonly ai: AiGatewayService,
    private readonly tasks: TasksService,
    private readonly settings: PlatformSettingsService,
    private readonly audit: AdminAuditService,
    private readonly bellai: BellaiService,
  ) {}

  onModuleInit() {
    this.tasks.register(DIAGNOSIS_TASK, (input: DiagnosisInput, ctx) => this.runDiagnosis(ctx.userId, input, ctx.progress));
  }

  private async checkFile(file?: Express.Multer.File) {
    if (!file) return;
    const maxMb = await this.settings.getNumber('upload_max_mb');
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.');
    if (file.size > maxMb * 1024 * 1024) throw new BadRequestException(`La foto supera el máximo de ${maxMb} MB.`);
  }

  private async requireConsent(user: User) {
    if (!(await hasPhotoConsent(this.ds, user.id))) {
      throw new ForbiddenException({
        code: 'consentimiento_requerido',
        message: 'Para analizar tus fotos necesitamos tu autorización explícita. Actívala en Privacidad.',
      });
    }
  }

  /** HU-035: validación rápida (síncrona) antes de enviar a análisis. */
  async validate(user: User, file: Express.Multer.File, type: string) {
    if (!file) throw new BadRequestException('Adjunta una foto en el campo "file".');
    await this.checkFile(file);
    const thresholds = await this.settings.getPhotoThresholds();
    return this.ai.postImage('/api/v1/analysis/validate', file, { type, thresholds }, 20_000);
  }

  private async storePhoto(userId: string, type: 'rostro' | 'cuerpo', file: Express.Multer.File): Promise<string> {
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `private/${userId}/photos/${randomUUID()}.${ext}`;
    await this.storage.uploadFile({ key, buffer: file.buffer, contentType: file.mimetype, cacheControl: 'private, no-store' });
    const [row] = await this.ds.query(
      `INSERT INTO fotografia (usuario_id, tipo, clave_archivo, mime, tamano_bytes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [userId, type, key, file.mimetype, file.size],
    );
    return row.id;
  }

  /** Inicia el diagnóstico: guarda las fotos como privadas y encola la tarea. Responde 202 con la tarea. */
  async start(user: User, face?: Express.Multer.File, body?: Express.Multer.File) {
    if (!face && !body) throw new BadRequestException('Envía al menos una foto de rostro ("face") o de cuerpo ("body").');
    await this.requireConsent(user);
    await this.checkFile(face);
    await this.checkFile(body);
    await this.bellai.ensureUser(user);
    const dedupe = createHash('sha256').update(face?.buffer ?? '').update(body?.buffer ?? '').digest('hex');
    const keepPhotos = await latestConsent(this.ds, user.id, PHOTO_RETENTION_CONSENT);
    const input: DiagnosisInput = {
      facePhotoId: face ? await this.storePhoto(user.id, 'rostro', face) : null,
      bodyPhotoId: body ? await this.storePhoto(user.id, 'cuerpo', body) : null,
      keepPhotos,
    };
    const task = await this.tasks.enqueue(user.id, DIAGNOSIS_TASK, input as any, dedupe);
    await this.audit.record({ actorUserId: user.id, action: 'DIAGNOSIS_REQUESTED', entityType: 'tarea', entityId: task.id, changes: { face: Boolean(face), body: Boolean(body) } });
    return task;
  }

  private async photo(userId: string, id: string) {
    const [row] = await this.ds.query('SELECT id, clave_archivo AS key, mime FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
    if (!row) throw new NotFoundException('La fotografía ya no está disponible.');
    return { ...row, buffer: await this.storage.readFile(row.key) };
  }

  private async discardPhotos(userId: string, ids: (string | null | undefined)[]) {
    for (const id of ids.filter(Boolean) as string[]) {
      const [row] = await this.ds.query('SELECT clave_archivo AS key FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
      if (!row) continue;
      await this.storage.deleteFile(row.key).catch((e) => this.logger.warn(`No se pudo borrar ${row.key}: ${e?.message}`));
      await this.ds.query('DELETE FROM fotografia WHERE id = $1 AND usuario_id = $2', [id, userId]);
    }
  }

  private async runDiagnosis(userId: string, input: DiagnosisInput, progress: (v: number) => Promise<void>) {
    const thresholds = await this.settings.getPhotoThresholds();
    let faceResult: FaceAnalysis | null = null;
    let bodyResult: BodyAnalysis | null = null;
    try {
      await progress(10);
      if (input.facePhotoId) {
        const p = await this.photo(userId, input.facePhotoId);
        faceResult = await this.ai.postImage<FaceAnalysis>('/api/v1/analysis/face', { buffer: p.buffer, mimetype: p.mime }, { thresholds }, 60_000);
        await progress(55);
      }
      if (input.bodyPhotoId) {
        const p = await this.photo(userId, input.bodyPhotoId);
        bodyResult = await this.ai.postImage<BodyAnalysis>('/api/v1/analysis/body', { buffer: p.buffer, mimetype: p.mime }, { thresholds }, 60_000);
        await progress(85);
      }
    } catch (err) {
      // La foto falló la validación o el análisis: no se conserva
      await this.discardPhotos(userId, [input.facePhotoId, input.bodyPhotoId]);
      throw err;
    }
    const merged = await this.mergeWithPrevious(userId, faceResult, bodyResult);
    const d = buildIntegratedDiagnosis(merged.face, merged.body);
    const keep = input.keepPhotos;
    const [row] = await this.ds.query(
      `INSERT INTO diagnostico (usuario_id, foto_rostro_id, foto_cuerpo_id, forma_rostro, tono_piel, subtono_piel, paleta_estacional, tipo_cuerpo,
         resumen, proporciones, caracteristicas_cabello, confianza, versiones_modelo, puntuacion_general, resultado_detallado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb)
       RETURNING id, creado_en AS "createdAt"`,
      [
        userId, keep ? input.facePhotoId ?? null : null, keep ? input.bodyPhotoId ?? null : null,
        d.faceShape, d.skinTone, d.undertone, d.season, d.bodyType, d.summary,
        JSON.stringify(d.body?.metrics ?? {}), JSON.stringify(d.hair ?? {}), JSON.stringify(d.confidence),
        JSON.stringify(d.modelVersions), Math.round(d.confidence.overall * 100), JSON.stringify(d),
      ],
    );
    if (!keep) await this.discardPhotos(userId, [input.facePhotoId, input.bodyPhotoId]);
    await this.audit.record({ actorUserId: userId, action: 'DIAGNOSIS_COMPLETED', entityType: 'diagnostico', entityId: row.id, changes: { photosKept: keep, modelVersions: d.modelVersions } });
    return { id: row.id, createdAt: row.createdAt, ...d };
  }

  /**
   * Si la usuaria solo envía una de las dos fotos, se conserva la otra parte de su último
   * diagnóstico para mantener una visión integral (HU-036).
   */
  private async mergeWithPrevious(userId: string, face: FaceAnalysis | null, body: BodyAnalysis | null) {
    if (face && body) return { face, body };
    const [prev] = await this.ds.query('SELECT resultado_detallado AS d FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1', [userId]);
    return mergeAnalyses(face, body, prev?.d);
  }

  private view(r: any) {
    return { id: r.id, createdAt: r.creado_en, ...(r.resultado_detallado || {}), photosKept: Boolean(r.foto_rostro_id || r.foto_cuerpo_id) };
  }

  async latest(user: User) {
    const [row] = await this.ds.query('SELECT * FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1', [user.id]);
    return row ? this.view(row) : null;
  }

  async list(user: User) {
    const rows = await this.ds.query(
      `SELECT id, creado_en AS "createdAt", forma_rostro AS "faceShape", paleta_estacional AS season, tipo_cuerpo AS "bodyType",
              subtono_piel AS undertone, resumen AS summary, puntuacion_general AS score
       FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 50`,
      [user.id],
    );
    return rows.map((r: any) => ({ ...r, score: r.score === null ? null : Number(r.score) }));
  }

  async get(user: User, id: string) {
    const [row] = await this.ds.query('SELECT * FROM diagnostico WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    if (!row) throw new NotFoundException('No se encontró el diagnóstico.');
    return this.view(row);
  }

  /** HU-029: eliminar un análisis concreto junto con sus fotos. */
  async remove(user: User, id: string) {
    const [row] = await this.ds.query('SELECT foto_rostro_id, foto_cuerpo_id FROM diagnostico WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    if (!row) throw new NotFoundException('No se encontró el diagnóstico.');
    await this.ds.query('DELETE FROM diagnostico_color WHERE diagnostico_id = $1', [id]);
    await this.ds.query('UPDATE recomendacion SET diagnostico_id = NULL WHERE diagnostico_id = $1 AND usuario_id = $2', [id, user.id]);
    await this.ds.query('DELETE FROM diagnostico WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    await this.discardPhotos(user.id, [row.foto_rostro_id, row.foto_cuerpo_id]);
    await this.audit.record({ actorUserId: user.id, action: 'DIAGNOSIS_DELETED', entityType: 'diagnostico', entityId: id });
    return { deleted: true };
  }

  /** Compatibilidad: análisis facial síncrono con el contrato que usa la app móvil actual. */
  async analyzeFaceSync(user: User, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Adjunta una foto en el campo "file".');
    await this.requireConsent(user);
    await this.checkFile(file);
    const thresholds = await this.settings.getPhotoThresholds();
    const result = await this.ai.postImage<FaceAnalysis>('/api/v1/analysis/face', file, { thresholds }, 60_000);
    await this.audit.record({ actorUserId: user.id, action: 'FACE_ANALYSIS_SYNC', entityType: 'vision', changes: { season: result.colorimetry?.season } });
    return toLegacyFaceContract(result);
  }
}
