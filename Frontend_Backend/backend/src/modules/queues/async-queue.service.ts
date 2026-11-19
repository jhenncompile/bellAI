import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AsyncTaskJob<T = any> {
  id: string;
  type: 'GDPR_EXPORT' | 'MEDIA_OPTIMIZE' | 'AUDIT_LOG_PERSIST' | 'ASYNC_NOTIFICATION';
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class AsyncQueueService {
  private readonly logger = new Logger(AsyncQueueService.name);
  private readonly jobQueue: Map<string, AsyncTaskJob> = new Map();

  /**
   * Encola un nuevo trabajo asíncrono y lo procesa de manera no bloqueante.
   */
  async enqueueJob<T>(type: AsyncTaskJob['type'], payload: T, processor: (payload: T) => Promise<any>): Promise<AsyncTaskJob<T>> {
    const jobId = crypto.randomUUID();
    const job: AsyncTaskJob<T> = {
      id: jobId,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    this.jobQueue.set(jobId, job);
    this.logger.log(`[Queue] Trabajo encolado: ${type} (ID: ${jobId})`);

    // Procesar asíncronamente en el siguiente tick del event loop
    setImmediate(async () => {
      job.status = 'processing';
      try {
        const result = await processor(payload);
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
        this.logger.log(`[Queue] Trabajo completado con éxito: ${type} (ID: ${jobId})`);
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Error desconocido';
        job.completedAt = new Date();
        this.logger.error(`[Queue] Fallo en trabajo: ${type} (ID: ${jobId}) - ${job.error}`);
      }
    });

    return job;
  }

  /**
   * Consulta el estado de un trabajo encolado.
   */
  getJobStatus(jobId: string): AsyncTaskJob | undefined {
    return this.jobQueue.get(jobId);
  }
}
