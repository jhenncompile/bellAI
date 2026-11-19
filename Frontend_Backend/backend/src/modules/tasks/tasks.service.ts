import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { Queue, Worker, Job } from 'bullmq';
import { PlatformSettingsService } from '../admin/settings/settings.service';

export type TaskState = 'pendiente' | 'procesando' | 'completada' | 'fallida';

export interface TaskContext {
  taskId: string;
  userId: string;
  progress: (value: number) => Promise<void>;
}

export type TaskHandler = (input: any, ctx: TaskContext) => Promise<any>;

export interface TaskView {
  id: string;
  type: string;
  status: TaskState;
  progress: number;
  result: any;
  error: string | null;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
}

/** Aviso de fin de tarea (p. ej. para mandar una notificación push). */
export interface TaskFinishedEvent {
  taskId: string;
  userId: string;
  type: string;
  status: 'completada' | 'fallida';
  result: any;
  error: string | null;
}

export type TaskFinishedListener = (event: TaskFinishedEvent) => void | Promise<void>;

const QUEUE_NAME = 'bellai-ia';

/**
 * HU-041: tareas pesadas (visión artificial, simulación, 3D) fuera del ciclo de la petición.
 * - Persistencia en la tabla `tarea` (estado, progreso, resultado y error ligados a la usuaria).
 * - BullMQ sobre Redis cuando REDIS_HOST está definido; si no, procesamiento en el mismo
 *   proceso (útil en desarrollo sin Redis).
 * - Evita duplicados: misma usuaria + tipo + hash de entrada con una tarea activa => se reutiliza.
 * - Tiempo máximo y concurrencia configurables desde el panel (platform_settings).
 */
@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private readonly handlers = new Map<string, TaskHandler>();
  /** Tiempo máximo propio de algunos tipos (p. ej. el escaneo del avatar procesa ~20 fotos). */
  private readonly minTimeouts = new Map<string, number>();
  private readonly finishedListeners: TaskFinishedListener[] = [];
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly useRedis: boolean;
  private readonly connection: { host: string; port: number; password?: string };

  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: PlatformSettingsService,
    config: ConfigService,
  ) {
    const host = config.get<string>('REDIS_HOST');
    this.useRedis = Boolean(host) && config.get<string>('QUEUE_DRIVER') !== 'memory';
    this.connection = {
      host: host || 'localhost',
      port: Number(config.get<string>('REDIS_PORT') || 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  async onModuleInit() {
    if (!this.useRedis) {
      this.logger.log('Cola de IA en memoria (define REDIS_HOST para usar BullMQ).');
      return;
    }
    const concurrency = await this.settings.getNumber('ai_queue_concurrency').catch(() => 2);
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker(QUEUE_NAME, (job: Job) => this.process(job.data.taskId), {
      connection: this.connection,
      concurrency,
    });
    this.worker.on('error', (err) => this.logger.error(`Worker BullMQ: ${err.message}`));
    this.logger.log(`Cola BullMQ '${QUEUE_NAME}' conectada a ${this.connection.host}:${this.connection.port} (concurrencia ${concurrency}).`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  /**
   * HU-30: estado real de la cola para el panel. Con Redis se comprueba la conexión con un PING;
   * en memoria procesa el propio servidor. Las cifras salen de la tabla `tarea` (últimas 24 h).
   */
  async health(): Promise<{
    driver: 'redis' | 'memoria';
    connected: boolean;
    latencyMs: number | null;
    pending: number;
    processing: number;
    completed24h: number;
    failed24h: number;
  }> {
    let connected = !this.useRedis;
    let latencyMs: number | null = null;
    if (this.queue) {
      try {
        const start = Date.now();
        // Una consulta real a Redis (las tareas en espera) sirve de comprobación de la conexión
        await Promise.race([this.queue.getJobCounts('wait'), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))]);
        latencyMs = Date.now() - start;
        connected = true;
      } catch {
        connected = false;
      }
    } else if (this.useRedis) {
      connected = false; // definida, pero no llegó a conectarse al arrancar
    }
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pending,
              COUNT(*) FILTER (WHERE estado = 'procesando')::int AS processing,
              COUNT(*) FILTER (WHERE estado = 'completada' AND finalizada_en >= NOW() - INTERVAL '24 hours')::int AS "completed24h",
              COUNT(*) FILTER (WHERE estado = 'fallida' AND finalizada_en >= NOW() - INTERVAL '24 hours')::int AS "failed24h"
       FROM tarea`,
    );
    return { driver: this.useRedis ? 'redis' : 'memoria', connected, latencyMs, ...row };
  }

  /** Cada módulo registra el procesador de sus tipos de tarea al iniciar. */
  /** Se llama cuando una tarea termina, bien o mal. Un fallo del oyente no afecta a la tarea. */
  onFinished(listener: TaskFinishedListener) {
    this.finishedListeners.push(listener);
  }

  private emitFinished(event: TaskFinishedEvent) {
    for (const listener of this.finishedListeners) {
      Promise.resolve()
        .then(() => listener(event))
        .catch((err) => this.logger.warn(`Aviso de fin de tarea ${event.taskId} fallido: ${err?.message}`));
    }
  }

  register(type: string, handler: TaskHandler, opts: { minTimeoutS?: number } = {}) {
    this.handlers.set(type, handler);
    if (opts.minTimeoutS) this.minTimeouts.set(type, opts.minTimeoutS);
  }

  static hash(value: unknown): string {
    return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
  }

  async enqueue(userId: string, type: string, input: Record<string, unknown>, dedupeKey?: string): Promise<TaskView> {
    if (!this.handlers.has(type)) throw new BadRequestException(`Tipo de tarea desconocido: ${type}`);
    const hash = dedupeKey ? TasksService.hash(dedupeKey) : null;
    if (hash) {
      const [active] = await this.dataSource.query(
        `SELECT id FROM tarea WHERE usuario_id = $1 AND tipo = $2 AND hash_entrada = $3 AND estado IN ('pendiente','procesando') LIMIT 1`,
        [userId, type, hash],
      );
      if (active) return this.get(active.id, userId);
    }
    const [row] = await this.dataSource.query(
      `INSERT INTO tarea (usuario_id, tipo, hash_entrada, entrada) VALUES ($1,$2,$3,$4::jsonb) RETURNING id`,
      [userId, type, hash, JSON.stringify(input)],
    );
    await this.dispatch(row.id);
    return this.get(row.id, userId);
  }

  private async dispatch(taskId: string) {
    if (this.queue) {
      await this.queue.add('tarea', { taskId }, { jobId: `${taskId}-${Date.now()}`, removeOnComplete: 500, removeOnFail: 500 });
    } else {
      setImmediate(() => void this.process(taskId));
    }
  }

  async retry(taskId: string, userId: string): Promise<TaskView> {
    const task = await this.get(taskId, userId);
    if (task.status !== 'fallida') throw new BadRequestException('Solo se pueden reintentar tareas fallidas.');
    await this.dataSource.query(
      `UPDATE tarea SET estado = 'pendiente', progreso = 0, error = NULL, resultado = NULL, finalizada_en = NULL, actualizada_en = CURRENT_TIMESTAMP WHERE id = $1`,
      [taskId],
    );
    await this.dispatch(taskId);
    return this.get(taskId, userId);
  }

  private async process(taskId: string) {
    // En PostgreSQL, TypeORM devuelve [filas, afectadas] para UPDATE ... RETURNING
    const res = await this.dataSource.query(
      `UPDATE tarea SET estado = 'procesando', intentos = intentos + 1, actualizada_en = CURRENT_TIMESTAMP
       WHERE id = $1 AND estado = 'pendiente' RETURNING id, usuario_id, tipo, entrada`,
      [taskId],
    );
    const row = (Array.isArray(res?.[0]) ? res[0] : res)?.[0];
    if (!row) return; // ya procesada o cancelada
    const handler = this.handlers.get(row.tipo);
    const ctx: TaskContext = {
      taskId,
      userId: row.usuario_id,
      progress: async (value) => {
        await this.dataSource.query('UPDATE tarea SET progreso = $2, actualizada_en = CURRENT_TIMESTAMP WHERE id = $1', [taskId, Math.max(0, Math.min(100, Math.round(value)))]);
      },
    };
    const configured = await this.settings.getNumber('ai_task_timeout_s').catch(() => 90);
    const timeoutS = Math.max(configured, this.minTimeouts.get(row.tipo) ?? 0);
    let timer: NodeJS.Timeout | undefined;
    try {
      if (!handler) throw new Error(`No hay procesador para ${row.tipo}`);
      const result = await Promise.race([
        handler(row.entrada, ctx),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new HttpException('El análisis tardó demasiado. Puedes reintentarlo.', 504)), timeoutS * 1000);
        }),
      ]);
      await this.dataSource.query(
        `UPDATE tarea SET estado = 'completada', progreso = 100, resultado = $2::jsonb, finalizada_en = CURRENT_TIMESTAMP, actualizada_en = CURRENT_TIMESTAMP WHERE id = $1`,
        [taskId, JSON.stringify(result ?? null)],
      );
      this.emitFinished({ taskId, userId: row.usuario_id, type: row.tipo, status: 'completada', result: result ?? null, error: null });
    } catch (err: any) {
      const message = this.userMessage(err);
      this.logger.warn(`Tarea ${row.tipo} ${taskId} fallida: ${err?.message}`);
      await this.dataSource.query(
        `UPDATE tarea SET estado = 'fallida', error = $2, resultado = $3::jsonb, finalizada_en = CURRENT_TIMESTAMP, actualizada_en = CURRENT_TIMESTAMP WHERE id = $1`,
        [taskId, message, JSON.stringify(this.errorDetail(err))],
      );
      this.emitFinished({ taskId, userId: row.usuario_id, type: row.tipo, status: 'fallida', result: null, error: message });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private userMessage(err: any): string {
    if (err instanceof HttpException) {
      const res: any = err.getResponse();
      if (typeof res === 'string') return res;
      if (res?.quality?.message) return res.quality.message;
      if (typeof res?.message === 'string') return res.message;
      if (Array.isArray(res?.message)) return res.message.join('. ');
    }
    return 'No pudimos completar el análisis. Inténtalo de nuevo.';
  }

  private errorDetail(err: any) {
    if (err instanceof HttpException) {
      const res: any = err.getResponse();
      if (res && typeof res === 'object' && res.code) return { code: res.code, quality: res.quality ?? null, status: err.getStatus() };
      return { status: err.getStatus() };
    }
    return null;
  }

  private toView(r: any): TaskView {
    return {
      id: r.id,
      type: r.tipo,
      status: r.estado,
      progress: Number(r.progreso),
      result: r.resultado,
      error: r.error,
      attempts: Number(r.intentos),
      createdAt: new Date(r.creada_en).toISOString(),
      finishedAt: r.finalizada_en ? new Date(r.finalizada_en).toISOString() : null,
    };
  }

  async get(taskId: string, userId: string): Promise<TaskView> {
    const [row] = await this.dataSource.query('SELECT * FROM tarea WHERE id = $1 AND usuario_id = $2', [taskId, userId]);
    if (!row) throw new NotFoundException('No se encontró la tarea solicitada.');
    return this.toView(row);
  }

  async list(userId: string, type?: string, limit = 20): Promise<TaskView[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM tarea WHERE usuario_id = $1 AND ($2::text IS NULL OR tipo = $2) ORDER BY creada_en DESC LIMIT $3`,
      [userId, type || null, Math.min(100, Math.max(1, limit))],
    );
    return rows.map((r: any) => this.toView(r));
  }

  /** Métricas para el panel administrativo (HU-033): tiempos y errores por tipo. */
  async stats() {
    return this.dataSource.query(`
      SELECT tipo AS type,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE estado = 'completada')::int AS completed,
             COUNT(*) FILTER (WHERE estado = 'fallida')::int AS failed,
             COUNT(*) FILTER (WHERE estado IN ('pendiente','procesando'))::int AS active,
             ROUND(AVG(EXTRACT(EPOCH FROM (finalizada_en - creada_en))) FILTER (WHERE estado = 'completada')::numeric, 2) AS "avgSeconds"
      FROM tarea WHERE creada_en > NOW() - INTERVAL '30 days'
      GROUP BY tipo ORDER BY total DESC`);
  }
}
