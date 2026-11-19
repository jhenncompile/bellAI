import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../privacy/entities/audit-log.entity';

export interface AuditLogQueryParams {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async list(params: AuditLogQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));

    const qb = this.auditRepository.createQueryBuilder('audit');

    if (params.action && params.action !== 'all') {
      qb.andWhere('audit.action = :action', { action: params.action });
    }

    if (params.entityType && params.entityType !== 'all') {
      qb.andWhere('(audit.entity_type = :entityType OR audit.action LIKE :prefix)', {
        entityType: params.entityType,
        prefix: params.entityType === 'platform_setting' ? 'PLATFORM_%' : 'USER_%',
      });
    }

    qb.orderBy('audit.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();

    const logs = rows.map((row) => {
      let inferredEntityType = row.entityType;
      if (!inferredEntityType) {
        inferredEntityType = row.action.startsWith('PLATFORM_') ? 'platform_setting' : 'user';
      }

      return {
        id: row.id,
        actorUserId: row.userId || null,
        action: row.action,
        entityType: inferredEntityType,
        entityId: row.entityId || null,
        changes: row.details || null,
        success: row.success !== undefined ? Boolean(row.success) : true,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      };
    });

    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async record(event: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    changes?: any;
    success?: boolean;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const entry = this.auditRepository.create({
        userId: event.actorUserId || undefined,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId || null,
        details: event.changes || null,
        success: event.success !== undefined ? event.success : true,
        ipAddress: event.ipAddress || '127.0.0.1',
      });
      await this.auditRepository.save(entry);
    } catch {
      // Ignorar errores en registro no crítico
    }
  }
}
