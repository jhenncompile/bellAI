import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { CreateDiagnosticDto, CreateOutfitDto, CreateRecommendationDto, CreateSimulationDto, ExplainRecommendationDto, SendMessageDto, UpsertAvatarDto } from './dto/bellai.dto';
import { BellaiContextBuilder } from './bellai-context.builder';
import { progressOf, templateForWeek, weeklyStreak } from './weekly-challenges';
import { BellaiRecommendationReasoner } from './bellai-recommendation.reasoner';

/** Historial unificado (incorporado desde main, HU-26 del equipo / HU-028 del PDF). */
export type HistoryItemType = 'diagnostic' | 'outfit' | 'consultation';

export interface UnifiedHistoryItem {
  id: string;
  type: HistoryItemType;
  title: string;
  subtitle: string;
  createdAt: Date;
  preview: Record<string, any>;
}

@Injectable()
export class BellaiService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly audit: AdminAuditService,
    private readonly contextBuilder: BellaiContextBuilder,
    private readonly reasoner: BellaiRecommendationReasoner,
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── Incorporado desde main: motivo de recomendaciones e historial unificado ──
  // Se leen nuestras tablas (diagnostico, outfit, conversacion). Los servicios de otros
  // módulos se resuelven con ModuleRef porque esos módulos ya importan BellaiModule.

  /** HU-18 (equipo) / HU-014: explica una recomendación con reglas, sin servicios externos. */
  async explainRecommendation(user: User, dto: ExplainRecommendationDto) {
    const context = await this.contextBuilder.build(user.id);
    return this.reasoner.explain(context, dto);
  }

  async getHistory(user: User, type: 'all' | HistoryItemType = 'all'): Promise<UnifiedHistoryItem[]> {
    const want = (t: HistoryItemType) => type === 'all' || type === t;
    const [diagnostics, outfits, conversations] = await Promise.all([
      want('diagnostic')
        ? this.dataSource.query(
            `SELECT id, forma_rostro, tono_piel, subtono_piel, paleta_estacional, resumen, creado_en
             FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 30`, [user.id])
        : [],
      want('outfit')
        ? this.dataSource.query(
            `SELECT o.id, o.titulo, o.explicacion, o.creado_en, oc.nombre AS ocasion,
                    (SELECT COUNT(*)::int FROM outfit_item oi WHERE oi.outfit_id = o.id) AS prendas
             FROM outfit o LEFT JOIN ocasion oc ON oc.id = o.ocasion_id
             WHERE o.usuario_id = $1 ORDER BY o.creado_en DESC LIMIT 30`, [user.id])
        : [],
      want('consultation')
        ? this.dataSource.query(
            `SELECT c.id, c.titulo, c.creada_en,
                    COALESCE((SELECT MAX(m.creado_en) FROM mensaje m WHERE m.conversacion_id = c.id), c.creada_en) AS actualizada
             FROM conversacion c WHERE c.usuario_id = $1 ORDER BY actualizada DESC LIMIT 30`, [user.id])
        : [],
    ]);
    const items: UnifiedHistoryItem[] = [
      ...diagnostics.map((d: any) => ({
        id: d.id,
        type: 'diagnostic' as const,
        title: `${d.paleta_estacional || 'Diagnóstico'} · Rostro ${d.forma_rostro || 'sin determinar'}`,
        subtitle: d.resumen || `Tono ${d.tono_piel || '-'} · Subtono ${d.subtono_piel || '-'}`,
        createdAt: d.creado_en,
        preview: { faceShape: d.forma_rostro, skinTone: d.tono_piel, undertone: d.subtono_piel, seasonalPalette: d.paleta_estacional },
      })),
      ...outfits.map((o: any) => ({
        id: o.id,
        type: 'outfit' as const,
        title: o.titulo || 'Outfit',
        subtitle: o.explicacion || o.ocasion || 'Combinación guardada',
        createdAt: o.creado_en,
        preview: { occasion: o.ocasion, garmentCount: o.prendas, reasonSummary: o.explicacion },
      })),
      ...conversations.map((c: any) => ({
        id: c.id,
        type: 'consultation' as const,
        title: c.titulo || 'Consulta a tu asesora',
        subtitle: 'Consulta al asistente BellAI',
        createdAt: c.actualizada,
        preview: {},
      })),
    ];
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Servicios de otros módulos, importados en diferido: esos archivos importan BellaiService y una
   * importación estática crearía un ciclo que deja la clase sin definir al inyectar dependencias.
   */
  private async peer(type: HistoryItemType): Promise<any> {
    if (type === 'diagnostic') return this.moduleRef.get((await import('../diagnosis/diagnosis.service')).DiagnosisService, { strict: false });
    if (type === 'outfit') return this.moduleRef.get((await import('../outfits/outfits.service')).OutfitsService, { strict: false });
    return this.moduleRef.get((await import('../assistant/assistant.service')).AssistantService, { strict: false });
  }

  async getHistoryItem(user: User, type: HistoryItemType, id: string) {
    const svc = await this.peer(type);
    const item = type === 'consultation' ? await svc.getConversation(user, id) : await svc.get(user, id);
    return { type, item };
  }

  async deleteHistoryItem(user: User, type: HistoryItemType, id: string) {
    const svc = await this.peer(type);
    if (type === 'consultation') await svc.deleteConversation(user, id);
    else await svc.remove(user, id);
    await this.audit.record({ actorUserId: user.id, action: 'HISTORY_ITEM_DELETED', entityType: type, entityId: id }).catch(() => undefined);
    return { deleted: true, type, id };
  }

  /** Crea el espejo de dominio con el mismo UUID del usuario autenticado. */
  async ensureUser(user: User) {
    const role = user.role === 'admin' ? 'administrador' : user.role === 'manager' ? 'gestor' : 'usuaria';
    const state = user.status === 'active' ? 'activo' : user.status === 'suspended' ? 'suspendido' : 'inactivo';
    await this.dataSource.query(
      `INSERT INTO usuario (id, nombre, correo, contrasena_hash, rol, suspendido, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, rol = EXCLUDED.rol, suspendido = EXCLUDED.suspendido, estado = EXCLUDED.estado, actualizado_en = CURRENT_TIMESTAMP`,
      [user.id, user.name, user.email, 'gestionado_por_auth_legacy', role, state === 'suspendido', state],
    );
  }

  /** El consentimiento fotográfico vive en gdpr_consents ('photo_analysis'); esta vista se mantiene por compatibilidad. */
  async getPhotoConsent(user: User) {
    await this.ensureUser(user);
    const [row] = await this.dataSource.query(
      `SELECT accepted AS "authorized", policy_version AS "policyVersion", created_at AS "updatedAt"
       FROM gdpr_consents WHERE user_id = $1 AND consent_type = 'photo_analysis' ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    );
    if (row) return row;
    const [legacy] = await this.dataSource.query('SELECT autorizado AS "authorized", version_politica AS "policyVersion", actualizado_en AS "updatedAt" FROM consentimiento_fotografia WHERE usuario_id = $1', [user.id]);
    return legacy || { authorized: false, policyVersion: null, updatedAt: null };
  }

  async setPhotoConsent(user: User, authorized: boolean, policyVersion: string) {
    await this.ensureUser(user);
    const [row] = await this.dataSource.query(
      `INSERT INTO consentimiento_fotografia (usuario_id, autorizado, version_politica)
       VALUES ($1,$2,$3) ON CONFLICT (usuario_id) DO UPDATE SET autorizado = EXCLUDED.autorizado, version_politica = EXCLUDED.version_politica, actualizado_en = CURRENT_TIMESTAMP
       RETURNING autorizado AS "authorized", version_politica AS "policyVersion", actualizado_en AS "updatedAt"`,
      [user.id, authorized, policyVersion],
    );
    await this.dataSource.query(
      `INSERT INTO gdpr_consents (user_id, consent_type, accepted, policy_version) VALUES ($1, 'photo_analysis', $2, $3)`,
      [user.id, authorized, policyVersion || 'v1.0'],
    );
    await this.audit.record({ actorUserId: user.id, action: 'PHOTO_CONSENT_UPDATED', entityType: 'consentimiento', changes: { authorized, policyVersion } });
    return row;
  }

  async listPhotos(user: User) {
    await this.ensureUser(user);
    return this.dataSource.query(`SELECT id, tipo AS type, mime, tamano_bytes AS "sizeBytes", creada_en AS "createdAt" FROM fotografia WHERE usuario_id = $1 ORDER BY creada_en DESC`, [user.id]);
  }

  async createPhoto(user: User, type: string, file: Express.Multer.File) {
    await this.ensureUser(user);
    const consent = await this.getPhotoConsent(user);
    if (!consent.authorized) throw new BadRequestException('Debes autorizar el uso de fotografías antes de subir una imagen.');
    if (!file?.buffer || !['rostro', 'cuerpo', 'prenda', 'simulacion', 'avatar'].includes(type)) {
      throw new BadRequestException('La fotografía o su tipo no son válidos.');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('Solo se aceptan imágenes JPG, PNG o WEBP de hasta 8 MB.');
    }
    const extension = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `private/${user.id}/photos/${randomUUID()}.${extension}`;
    await this.storageService.uploadFile({ key, buffer: file.buffer, contentType: file.mimetype, cacheControl: 'private, no-store' });
    const [photo] = await this.dataSource.query(
      `INSERT INTO fotografia (usuario_id, tipo, clave_archivo, mime, tamano_bytes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, tipo AS type, mime, tamano_bytes AS "sizeBytes", creada_en AS "createdAt"`,
      [user.id, type, key, file.mimetype, file.size],
    );
    await this.audit.record({ actorUserId: user.id, action: 'PHOTO_UPLOADED', entityType: 'fotografia', entityId: photo.id, changes: { type } });
    return photo;
  }

  async listDiagnostics(user: User) {
    await this.ensureUser(user);
    return this.dataSource.query(`SELECT id, foto_rostro_id AS "facePhotoId", foto_cuerpo_id AS "bodyPhotoId", forma_rostro AS "faceShape", tono_piel AS "skinTone", subtono_piel AS undertone, paleta_estacional AS "seasonalPalette", resumen AS summary, resultado_detallado AS details, creado_en AS "createdAt" FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC`, [user.id]);
  }

  async createDiagnostic(user: User, dto: CreateDiagnosticDto) {
    await this.ensureUser(user);
    const photoConsent = await this.getPhotoConsent(user);
    if ((dto.facePhotoId || dto.bodyPhotoId) && !photoConsent.authorized) {
      throw new BadRequestException('Debes autorizar el uso de fotografías antes de guardar un análisis.');
    }
    const [diagnostic] = await this.dataSource.query(
      `INSERT INTO diagnostico (usuario_id, foto_rostro_id, foto_cuerpo_id, forma_rostro, tono_piel, subtono_piel, paleta_estacional, resumen, proporciones, caracteristicas_cabello, resultado_detallado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)
       RETURNING id, creado_en AS "createdAt"`,
      [user.id, dto.facePhotoId || null, dto.bodyPhotoId || null, dto.faceShape || null, dto.skinTone || null, dto.undertone || null, dto.seasonalPalette || null, dto.summary || null, JSON.stringify(dto.proportions || {}), JSON.stringify(dto.hairFeatures || {}), JSON.stringify(dto.details)],
    );
    for (const colorId of dto.colorIds || []) await this.dataSource.query('INSERT INTO diagnostico_color (diagnostico_id, color_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [diagnostic.id, colorId]);
    await this.audit.record({ actorUserId: user.id, action: 'DIAGNOSIS_SAVED', entityType: 'diagnostico', entityId: diagnostic.id });
    return diagnostic;
  }

  async listConversations(user: User) {
    await this.ensureUser(user);
    return this.dataSource.query(`SELECT c.id, c.titulo AS title, c.creada_en AS "createdAt", COALESCE(json_agg(json_build_object('id', m.id, 'sender', m.emisor, 'content', m.contenido, 'createdAt', m.creado_en) ORDER BY m.creado_en) FILTER (WHERE m.id IS NOT NULL), '[]') AS messages FROM conversacion c LEFT JOIN mensaje m ON m.conversacion_id = c.id WHERE c.usuario_id = $1 GROUP BY c.id ORDER BY c.creada_en DESC`, [user.id]);
  }

  async createConversation(user: User, title?: string) {
    await this.ensureUser(user);
    const [row] = await this.dataSource.query('INSERT INTO conversacion (usuario_id, titulo) VALUES ($1,$2) RETURNING id, titulo AS title, creada_en AS "createdAt"', [user.id, title || null]);
    return row;
  }

  async sendMessage(user: User, conversationId: string, dto: SendMessageDto) {
    await this.ensureUser(user);
    const [conversation] = await this.dataSource.query('SELECT id FROM conversacion WHERE id = $1 AND usuario_id = $2', [conversationId, user.id]);
    if (!conversation) throw new NotFoundException('No se encontró la conversación solicitada.');
    const [message] = await this.dataSource.query(`INSERT INTO mensaje (conversacion_id, emisor, contenido) VALUES ($1,'usuaria',$2) RETURNING id, emisor AS sender, contenido AS content, creado_en AS "createdAt"`, [conversationId, dto.content]);
    const reply = this.buildAdvisorReply(dto.content);
    const [assistant] = await this.dataSource.query(`INSERT INTO mensaje (conversacion_id, emisor, contenido) VALUES ($1,'asistente',$2) RETURNING id, emisor AS sender, contenido AS content, creado_en AS "createdAt"`, [conversationId, reply]);
    return { message, assistant };
  }

  async listOutfits(user: User) {
    await this.ensureUser(user);
    return this.dataSource.query(`SELECT o.id, o.titulo AS title, o.explicacion AS explanation, o.guardado AS saved, o.favorito AS favorite, o.valoracion AS rating, o.creado_en AS "createdAt", COALESCE(json_agg(op.prenda_id) FILTER (WHERE op.prenda_id IS NOT NULL), '[]') AS "garmentIds" FROM outfit o LEFT JOIN outfit_prenda op ON op.outfit_id = o.id WHERE o.usuario_id = $1 GROUP BY o.id ORDER BY o.creado_en DESC`, [user.id]);
  }

  async createOutfit(user: User, dto: CreateOutfitDto) {
    await this.ensureUser(user);
    const [outfit] = await this.dataSource.query(`INSERT INTO outfit (usuario_id, titulo, explicacion, clima_resumen, guardado, favorito) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, creado_en AS "createdAt"`, [user.id, dto.title || null, dto.explanation || null, dto.weatherSummary || null, dto.saved ?? true, dto.favorite ?? false]);
    for (const garmentId of dto.garmentIds) await this.dataSource.query('INSERT INTO outfit_prenda (usuario_id, outfit_id, prenda_id) SELECT $1,$2,id FROM prenda WHERE id = $3 AND usuario_id = $1', [user.id, outfit.id, garmentId]);
    return outfit;
  }

  async listRecommendations(user: User) {
    await this.ensureUser(user);
    return this.dataSource.query(`SELECT id, diagnostico_id AS "diagnosticId", tipo AS type, contenido AS content, explicacion AS explanation, creada_en AS "createdAt" FROM recomendacion WHERE usuario_id = $1 ORDER BY creada_en DESC`, [user.id]);
  }

  async createRecommendation(user: User, dto: CreateRecommendationDto) {
    await this.ensureUser(user);
    const [row] = await this.dataSource.query(`INSERT INTO recomendacion (usuario_id, diagnostico_id, tipo, contenido, explicacion) VALUES ($1,$2,$3,$4,$5) RETURNING id, creada_en AS "createdAt"`, [user.id, dto.diagnosticId || null, dto.type, dto.content, dto.explanation]);
    return row;
  }

  /** Reto vigente hoy (programado a mano o generado), con las tareas y lo que la usuaria marcó. */
  private async findActiveChallenge(userId: string) {
    const [challenge] = await this.dataSource.query(
      `SELECT r.id, r.titulo AS title, r.descripcion AS description, to_char(r.inicio, 'YYYY-MM-DD') AS start, to_char(r.fin, 'YYYY-MM-DD') AS "end", (r.fin - CURRENT_DATE) AS "daysLeft",
              COALESCE(json_agg(json_build_object('id', t.id, 'title', t.titulo, 'description', t.descripcion, 'action', t.accion,
                'order', t.orden, 'completedAt', p.completada_en) ORDER BY t.orden) FILTER (WHERE t.id IS NOT NULL), '[]') AS tasks
       FROM reto_semanal r
       LEFT JOIN reto_tarea t ON t.reto_id = r.id
       LEFT JOIN reto_progreso p ON p.tarea_id = t.id AND p.usuario_id = $1
       WHERE CURRENT_DATE BETWEEN r.inicio AND r.fin
       GROUP BY r.id ORDER BY r.inicio DESC LIMIT 1`,
      [userId],
    );
    return challenge || null;
  }

  /**
   * HU-28: si nadie programó un reto para esta semana, se crea el de la semana (lunes a domingo) a
   * partir del catálogo. El índice único sobre `inicio` evita duplicados si dos peticiones llegan a la vez.
   */
  private async ensureWeeklyChallenge() {
    await this.dataSource.transaction(async (m) => {
      const [{ week }] = await m.query(`SELECT EXTRACT(WEEK FROM CURRENT_DATE)::int AS week`);
      const tpl = templateForWeek(week);
      const [created] = await m.query(
        `INSERT INTO reto_semanal (titulo, descripcion, inicio, fin)
         VALUES ($1, $2, date_trunc('week', CURRENT_DATE)::date, date_trunc('week', CURRENT_DATE)::date + 6)
         ON CONFLICT (inicio) DO NOTHING RETURNING id`,
        [tpl.title, tpl.description],
      );
      if (!created) return;
      for (const [i, task] of tpl.tasks.entries()) {
        await m.query('INSERT INTO reto_tarea (reto_id, titulo, descripcion, accion, orden) VALUES ($1,$2,$3,$4,$5)', [created.id, task.title, task.description, task.action, i + 1]);
      }
    });
  }

  /** Avance en los retos anteriores (las 8 últimas semanas), de la más reciente a la más antigua. */
  private async challengeHistory(userId: string, beforeStart: string) {
    const rows = await this.dataSource.query(
      `SELECT r.id, r.titulo AS title, to_char(r.inicio, 'YYYY-MM-DD') AS start, to_char(r.fin, 'YYYY-MM-DD') AS "end", COUNT(t.id)::int AS total, COUNT(p.tarea_id)::int AS completed
       FROM reto_semanal r
       LEFT JOIN reto_tarea t ON t.reto_id = r.id
       LEFT JOIN reto_progreso p ON p.tarea_id = t.id AND p.usuario_id = $1
       WHERE r.inicio < $2::date
       GROUP BY r.id ORDER BY r.inicio DESC LIMIT 8`,
      [userId, beforeStart],
    );
    return rows.map((r: any) => ({ ...r, percent: r.total ? Math.round((r.completed / r.total) * 100) : 0 }));
  }

  async getActiveChallenge(user: User) {
    await this.ensureUser(user);
    let challenge = await this.findActiveChallenge(user.id);
    if (!challenge) {
      await this.ensureWeeklyChallenge();
      challenge = await this.findActiveChallenge(user.id);
    }
    if (!challenge) return null;
    const progress = progressOf(challenge.tasks);
    const history = await this.challengeHistory(user.id, challenge.start);
    return {
      ...challenge,
      daysLeft: Number(challenge.daysLeft),
      progress,
      history,
      streak: weeklyStreak([progress, ...history]),
    };
  }

  /** Marca o desmarca una tarea. Solo las del reto de esta semana: las pasadas quedan como estaban. */
  async toggleChallengeTask(user: User, taskId: string, completed: boolean) {
    await this.ensureUser(user);
    if (typeof completed !== 'boolean') throw new BadRequestException('Indica si la tarea está completada.');
    const active = await this.findActiveChallenge(user.id);
    if (!active?.tasks.some((t: any) => t.id === taskId)) {
      throw new NotFoundException('Esa tarea no es del reto de esta semana.');
    }
    if (completed) await this.dataSource.query('INSERT INTO reto_progreso (usuario_id, tarea_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, taskId]);
    else await this.dataSource.query('DELETE FROM reto_progreso WHERE usuario_id = $1 AND tarea_id = $2', [user.id, taskId]);
    return this.getActiveChallenge(user);
  }

  async listSimulations(user: User) { await this.ensureUser(user); return this.dataSource.query('SELECT id, fotografia_original_id AS "originalPhotoId", fotografia_resultado_id AS "resultPhotoId", tipo AS type, opciones AS options, creada_en AS "createdAt" FROM simulacion WHERE usuario_id = $1 ORDER BY creada_en DESC', [user.id]); }
  async createSimulation(user: User, dto: CreateSimulationDto) { await this.ensureUser(user); const [row] = await this.dataSource.query('INSERT INTO simulacion (usuario_id, fotografia_original_id, fotografia_resultado_id, tipo, opciones) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id, creada_en AS "createdAt"', [user.id, dto.originalPhotoId, dto.resultPhotoId, dto.type, JSON.stringify(dto.options || {})]); return row; }
  async getAvatar(user: User) { await this.ensureUser(user); const [row] = await this.dataSource.query('SELECT id, clave_modelo_3d AS "modelKey", configuracion AS configuration, actualizado_en AS "updatedAt" FROM avatar WHERE usuario_id = $1', [user.id]); return row || null; }
  async upsertAvatar(user: User, dto: UpsertAvatarDto) { await this.ensureUser(user); const [row] = await this.dataSource.query(`INSERT INTO avatar (usuario_id, clave_modelo_3d, configuracion) VALUES ($1,$2,$3::jsonb) ON CONFLICT (usuario_id) DO UPDATE SET clave_modelo_3d = EXCLUDED.clave_modelo_3d, configuracion = EXCLUDED.configuracion, actualizado_en = CURRENT_TIMESTAMP RETURNING id, clave_modelo_3d AS "modelKey", configuracion AS configuration, actualizado_en AS "updatedAt"`, [user.id, dto.modelKey, JSON.stringify(dto.configuration || {})]); return row; }

  private buildAdvisorReply(content: string) {
    const query = content.toLowerCase();
    if (query.includes('color') || query.includes('paleta')) return 'Revisa tu paleta personal y elige un color principal que armonice con tu subtono. Puedes guardar la recomendación que más te sirva.';
    if (query.includes('corte') || query.includes('cabello') || query.includes('pelo')) return 'Tu análisis facial puede orientarte sobre cortes para explorar. Tómalos como sugerencias y elige siempre lo que te haga sentir cómoda.';
    if (query.includes('outfit') || query.includes('evento')) return 'Puedo ayudarte a combinar prendas de tu armario según la ocasión. Guarda los conjuntos que quieras volver a usar.';
    return 'Cuéntame qué prenda, ocasión o color quieres explorar y prepararemos una recomendación útil para ti.';
  }
}
