import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminAuditService } from '../admin/audit/audit.service';
import { CreateIncidentDto, ListIncidentsQuery, UpdateIncidentDto } from './incidents.dto';

const COLUMNS = `i.id, i.usuario_id AS "userId", u.name AS "userName", u.email AS "userEmail", i.tipo AS type, i.titulo AS title,
  i.descripcion AS description, i.estado AS status, i.prioridad AS priority, i.contexto AS context, i.respuesta AS response,
  i.atendida_por AS "handledBy", i.creada_en AS "createdAt", i.actualizada_en AS "updatedAt", i.resuelta_en AS "resolvedAt"`;

/** HU-031: incidencias reportadas por las usuarias y su atención por el equipo administrador. */
@Injectable()
export class IncidentsService {
  constructor(private readonly ds: DataSource, private readonly audit: AdminAuditService) {}

  async create(userId: string, dto: CreateIncidentDto) {
    // Las incidencias de error o privacidad empiezan con prioridad alta
    const priority = dto.type === 'privacidad' || dto.type === 'error' ? 'alta' : 'media';
    const [row] = await this.ds.query(
      `INSERT INTO incidencia (usuario_id, tipo, titulo, descripcion, prioridad, contexto) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id, tipo AS type, titulo AS title, estado AS status, prioridad AS priority, creada_en AS "createdAt"`,
      [userId, dto.type, dto.title.trim(), dto.description.trim(), priority, JSON.stringify(dto.context || {})],
    );
    await this.audit.record({ actorUserId: userId, action: 'INCIDENT_REPORTED', entityType: 'incidencia', entityId: row.id, changes: { type: dto.type } });
    return row;
  }

  mine(userId: string) {
    return this.ds.query(
      `SELECT id, tipo AS type, titulo AS title, descripcion AS description, estado AS status, respuesta AS response,
              creada_en AS "createdAt", actualizada_en AS "updatedAt", resuelta_en AS "resolvedAt"
       FROM incidencia WHERE usuario_id = $1 ORDER BY creada_en DESC LIMIT 50`,
      [userId],
    );
  }

  async list(q: ListIncidentsQuery) {
    const page = q.page || 1;
    const limit = q.limit || 20;
    const params = [q.status || null, q.type || null, q.priority || null, q.search ? `%${q.search}%` : null];
    const where = `($1::text IS NULL OR i.estado = $1) AND ($2::text IS NULL OR i.tipo = $2) AND ($3::text IS NULL OR i.prioridad = $3)
                   AND ($4::text IS NULL OR i.titulo ILIKE $4 OR i.descripcion ILIKE $4)`;
    const rows = await this.ds.query(
      `SELECT ${COLUMNS} FROM incidencia i LEFT JOIN users u ON u.id = i.usuario_id WHERE ${where}
       ORDER BY CASE i.estado WHEN 'abierta' THEN 0 WHEN 'en_proceso' THEN 1 ELSE 2 END,
                CASE i.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, i.creada_en DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    const [{ total }] = await this.ds.query(`SELECT COUNT(*)::int AS total FROM incidencia i WHERE ${where}`, params);
    return { data: rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async stats() {
    const [row] = await this.ds.query(`
      SELECT COUNT(*) FILTER (WHERE estado = 'abierta')::int AS open,
             COUNT(*) FILTER (WHERE estado = 'en_proceso')::int AS "inProgress",
             COUNT(*) FILTER (WHERE estado IN ('resuelta','cerrada'))::int AS resolved,
             COUNT(*) FILTER (WHERE prioridad = 'alta' AND estado IN ('abierta','en_proceso'))::int AS "highPriority",
             ROUND(AVG(EXTRACT(EPOCH FROM (resuelta_en - creada_en)) / 3600) FILTER (WHERE resuelta_en IS NOT NULL)::numeric, 1) AS "avgResolutionHours"
      FROM incidencia`);
    return row;
  }

  async update(id: string, dto: UpdateIncidentDto, actorId: string) {
    const [current] = await this.ds.query('SELECT estado, prioridad, respuesta FROM incidencia WHERE id = $1', [id]);
    if (!current) throw new NotFoundException('No se encontró la incidencia.');
    const resolving = dto.status && ['resuelta', 'cerrada'].includes(dto.status) && !['resuelta', 'cerrada'].includes(current.estado);
    await this.ds.query(
      `UPDATE incidencia SET estado = COALESCE($2, estado), prioridad = COALESCE($3, prioridad), respuesta = COALESCE($4, respuesta),
              atendida_por = $5, actualizada_en = CURRENT_TIMESTAMP,
              resuelta_en = CASE WHEN $6 THEN CURRENT_TIMESTAMP WHEN $2 IN ('abierta','en_proceso') THEN NULL ELSE resuelta_en END
       WHERE id = $1`,
      [id, dto.status ?? null, dto.priority ?? null, dto.response ?? null, actorId, Boolean(resolving)],
    );
    await this.audit.record({
      actorUserId: actorId, action: 'INCIDENT_UPDATED', entityType: 'incidencia', entityId: id,
      changes: { before: { status: current.estado, priority: current.prioridad }, after: dto },
    });
    const [row] = await this.ds.query(`SELECT ${COLUMNS} FROM incidencia i LEFT JOIN users u ON u.id = i.usuario_id WHERE i.id = $1`, [id]);
    return row;
  }
}
