import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { CreateAiModelDto, UpdateAiModelDto } from './ai-models.dto';
import { MediaService } from '../media/media.service';

/** CP-032-04: formatos de artefacto de modelo admitidos. */
export const MODEL_ARTIFACT_EXTENSIONS = ['.onnx', '.pt', '.pth', '.tflite', '.task', '.safetensors', '.bin', '.glb', '.gltf'];

const COLUMNS = `id, nombre AS name, tarea AS task, version, entorno AS environment, estado AS status, descripcion AS description,
  artefacto_id AS "artifactId", metricas AS metrics, ultimo_chequeo AS "lastCheck", registrado_por AS "registeredBy",
  activado_por AS "activatedBy", activado_en AS "activatedAt", creado_en AS "createdAt", actualizado_en AS "updatedAt"`;

/**
 * HU-032: registro de versiones de modelos de IA por entorno.
 * - Solo una versión activa por modelo y entorno (índice único parcial).
 * - Antes de activar se comprueba la compatibilidad con el servicio de IA; si falla,
 *   se conserva la versión activa anterior y se informa el error.
 * - Los diagnósticos guardan la versión usada, así que activar otra no altera resultados previos.
 */
@Injectable()
export class AiModelsService {
  readonly environment: string;

  constructor(
    private readonly ds: DataSource,
    private readonly ai: AiGatewayService,
    private readonly audit: AdminAuditService,
    private readonly media: MediaService,
    config: ConfigService,
  ) {
    const env = config.get<string>('APP_ENV') || (config.get<string>('NODE_ENV') === 'production' ? 'produccion' : 'desarrollo');
    this.environment = ['desarrollo', 'pruebas', 'produccion'].includes(env) ? env : 'desarrollo';
  }

  async list(environment?: string) {
    const rows = await this.ds.query(
      `SELECT ${COLUMNS} FROM modelo_ia WHERE ($1::text IS NULL OR entorno = $1) ORDER BY nombre, entorno, creado_en DESC`,
      [environment || null],
    );
    let service: any[] = [];
    let serviceOnline = true;
    try {
      service = await this.ai.get<any[]>('/api/v1/models');
    } catch {
      serviceOnline = false;
    }
    return { environment: this.environment, serviceOnline, serviceAnalyzers: service, models: rows };
  }

  async active() {
    const rows = await this.ds.query(`SELECT nombre AS name, entorno AS environment, version, activado_en AS "activatedAt" FROM modelo_ia WHERE estado = 'activo' ORDER BY nombre, entorno`);
    return rows;
  }

  private async find(id: string) {
    const [row] = await this.ds.query(`SELECT ${COLUMNS} FROM modelo_ia WHERE id = $1`, [id]);
    if (!row) throw new NotFoundException('No se encontró el modelo.');
    return row;
  }

  async create(dto: CreateAiModelDto, actorId: string) {
    const exists = await this.ds.query('SELECT 1 FROM modelo_ia WHERE nombre = $1 AND version = $2 AND entorno = $3', [dto.name, dto.version, dto.environment || this.environment]);
    if (exists.length) throw new ConflictException('Esa versión ya está registrada para este entorno.');
    const [row] = await this.ds.query(
      `INSERT INTO modelo_ia (nombre, tarea, version, entorno, descripcion, artefacto_id, metricas, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
      [dto.name, dto.task, dto.version, dto.environment || this.environment, dto.description || null, dto.artifactId || null, JSON.stringify(dto.metrics || {}), actorId],
    );
    await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_REGISTERED', entityType: 'modelo_ia', entityId: row.id, changes: dto });
    return this.find(row.id);
  }

  async update(id: string, dto: UpdateAiModelDto, actorId: string) {
    const current = await this.find(id);
    await this.ds.query(
      `UPDATE modelo_ia SET descripcion = COALESCE($2, descripcion), metricas = COALESCE($3::jsonb, metricas), artefacto_id = COALESCE($4, artefacto_id), actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, dto.description ?? null, dto.metrics ? JSON.stringify(dto.metrics) : null, dto.artifactId ?? null],
    );
    await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_UPDATED', entityType: 'modelo_ia', entityId: id, changes: { before: { description: current.description, metrics: current.metrics }, after: dto } });
    return this.find(id);
  }

  /** Comprueba compatibilidad: el analizador existe, carga sus pesos y declara la misma versión. */
  async check(id: string) {
    const model = await this.find(id);
    let result: any;
    try {
      result = await this.ai.get(`/api/v1/models/${encodeURIComponent(model.name)}/check`, 30_000);
    } catch (err: any) {
      result = { compatible: false, error: err?.message || 'El servicio de IA no respondió.' };
    }
    if (result.compatible && result.version && result.version !== model.version) {
      result = { ...result, compatible: false, error: `El servicio de IA ejecuta la versión ${result.version}, no ${model.version}.` };
    }
    const check = { ...result, checkedAt: new Date().toISOString() };
    await this.ds.query('UPDATE modelo_ia SET ultimo_chequeo = $2::jsonb, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1', [id, JSON.stringify(check)]);
    return check;
  }

  async activate(id: string, actorId: string) {
    const model = await this.find(id);
    if (model.status === 'activo') throw new BadRequestException('Este modelo ya está activo.');
    const check = await this.check(id);
    if (!check.compatible) {
      await this.ds.query(`UPDATE modelo_ia SET estado = 'fallido', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_ACTIVATION_FAILED', entityType: 'modelo_ia', entityId: id, success: false, changes: { error: check.error } });
      throw new UnprocessableEntityException({ message: `No se activó el modelo: ${String(check.error).replace(/\.$/, "")}. Se mantiene la versión anterior.`, check });
    }
    const previous = await this.ds.transaction(async (m) => {
      const prev = await m.query(`SELECT id, version FROM modelo_ia WHERE nombre = $1 AND entorno = $2 AND estado = 'activo'`, [model.name, model.environment]);
      await m.query(`UPDATE modelo_ia SET estado = 'inactivo', actualizado_en = CURRENT_TIMESTAMP WHERE nombre = $1 AND entorno = $2 AND estado = 'activo'`, [model.name, model.environment]);
      await m.query(`UPDATE modelo_ia SET estado = 'activo', activado_por = $2, activado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [id, actorId]);
      return prev[0] || null;
    });
    await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_ACTIVATED', entityType: 'modelo_ia', entityId: id, changes: { version: model.version, environment: model.environment, previousVersion: previous?.version ?? null } });
    return this.find(id);
  }

  async deactivate(id: string, actorId: string) {
    const model = await this.find(id);
    if (model.status !== 'activo') throw new BadRequestException('El modelo no está activo.');
    await this.ds.query(`UPDATE modelo_ia SET estado = 'inactivo', actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_DEACTIVATED', entityType: 'modelo_ia', entityId: id, changes: { version: model.version } });
    return this.find(id);
  }

  /** CP-032-04: sube el archivo del modelo; rechaza formatos no soportados. */
  async uploadArtifact(id: string, file: Express.Multer.File, actorId: string) {
    const model = await this.find(id);
    if (!file?.buffer) throw new BadRequestException('Adjunta el archivo del modelo en el campo "file".');
    const ext = (file.originalname.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
    if (!MODEL_ARTIFACT_EXTENSIONS.includes(ext)) {
      await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_ARTIFACT_REJECTED', entityType: 'modelo_ia', entityId: id, success: false, changes: { filename: file.originalname } });
      throw new BadRequestException(`Formato de modelo no válido (${ext || 'sin extensión'}). Formatos admitidos: ${MODEL_ARTIFACT_EXTENSIONS.join(', ')}.`);
    }
    const asset = await this.media.processAndUploadMedia(
      file,
      { title: `${model.name} ${model.version}`, mediaType: 'ai_component', systemFunction: 'motor_inferencia_ia' } as any,
      actorId,
    );
    await this.ds.query('UPDATE modelo_ia SET artefacto_id = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1', [id, asset.id]);
    await this.audit.record({ actorUserId: actorId, action: 'AI_MODEL_ARTIFACT_UPLOADED', entityType: 'modelo_ia', entityId: id, changes: { assetId: asset.id, filename: file.originalname, sizeBytes: file.size } });
    return this.find(id);
  }

  /** Registra en este entorno los analizadores que expone el servicio de IA (si aún no existen). */
  async syncFromService(actorId: string) {
    const analyzers = await this.ai.get<any[]>('/api/v1/models');
    const created: string[] = [];
    for (const a of analyzers) {
      const exists = await this.ds.query('SELECT 1 FROM modelo_ia WHERE nombre = $1 AND version = $2 AND entorno = $3', [a.name, a.version, this.environment]);
      if (exists.length) continue;
      await this.create({ name: a.name, task: a.task, version: a.version, environment: this.environment as any, description: a.description }, actorId);
      created.push(`${a.name}@${a.version}`);
    }
    return { created, environment: this.environment };
  }
}
