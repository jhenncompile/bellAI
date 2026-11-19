import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { BellaiService } from '../bellai/bellai.service';
import { StyleService } from '../style/style.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { topDimensions } from '../style/style-dna';
import { matchesDeclared } from '../../common/color/color.util';
import { OutfitsService } from '../outfits/outfits.service';
import type { Garment } from '../outfits/outfit.engine';
import { ChatMessage, ConverseResult, LlmService, ToolExecutor } from './llm.service';
import { UsageService } from '../subscriptions/usage.service';
import { explainPrompt, ruleBasedReply, systemPrompt, UserStyleContext } from './assistant.prompts';
import { ASSISTANT_TOOLS, detectTopics, outfitSummary, PROFILE_SECTIONS, searchGarments, toBool, toNumber, Topic, topicSection, trimHistory } from './assistant.context';

/** Mensajes que se leen de la base para armar el historial (luego se recorta por tamaño). */
const HISTORY_LIMIT = 12;

/** Valor de `engine` en la respuesta: qué generó el texto. */
const engineOf = (r: ConverseResult | null) => (!r ? 'reglas' : r.provider === 'kimi' ? 'kimi' : 'llm_local');

@Injectable()
export class AssistantService {
  constructor(
    private readonly ds: DataSource,
    private readonly llm: LlmService,
    private readonly bellai: BellaiService,
    private readonly style: StyleService,
    private readonly audit: AdminAuditService,
    private readonly outfits: OutfitsService,
    private readonly usage: UsageService,
  ) {}

  /** Contexto mínimo y estructurado (sin fotos ni datos de contacto). */
  async userContext(user: User): Promise<UserStyleContext> {
    const { dimensions, diagnosis: d, prefs } = await this.style.computeDna(user);
    const rows = await this.ds.query(
      `SELECT category, subcategory, color, name FROM wardrobe_items WHERE user_id = $1 AND status = 'confirmed' ORDER BY updated_at DESC`,
      [user.id],
    );
    const byCategory: Record<string, number> = {};
    for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    const rec = d?.recommendations ?? {};
    return {
      name: user.name?.split(' ')[0] ?? null,
      season: d?.season ?? null,
      undertone: d?.undertone ?? null,
      skinTone: d?.skinTone ?? null,
      contrast: d?.contrastLevel ?? null,
      faceShape: d?.faceShape ?? null,
      bodyType: d?.bodyType ?? null,
      paletteNames: (d?.palette ?? []).filter((p: any) => !matchesDeclared(p.name, p.hex, prefs.avoidedColors)).map((p: any) => p.name),
      avoidColors: (rec.colors?.avoid ?? []).map((c: any) => c.name),
      haircuts: rec.haircuts ?? [],
      hairTexture: d?.hair?.texture && !d.hair.texture.uncertain ? d.hair.texture.type : null,
      hairCare: rec.hairCare ?? [],
      eyes: d?.face?.features?.reliable
        ? `ojos ${String(d.face.features.eyes.tilt).toLowerCase()}, ${String(d.face.features.eyes.spacing).toLowerCase()}; labios ${String(d.face.features.lips.volume).toLowerCase()}`
        : null,
      makeup: rec.makeup ?? [],
      garmentCuts: rec.garmentCuts ?? [],
      dnaTop: topDimensions(dimensions, 3).map((t) => `${t.label} (${Math.round(t.value)})`),
      preferredStyles: prefs.preferredStyles ?? [],
      declaredAvoid: prefs.avoidedColors ?? [],
      occasions: prefs.occasions ?? [],
      budget: prefs.budgetPerGarment ?? null,
      wardrobe: {
        total: rows.length,
        byCategory,
        sample: rows.slice(0, 25).map((r: any) => `${r.name || r.subcategory}${r.color ? ` (${r.color})` : ''}`),
      },
    };
  }

  private async conversation(user: User, id: string) {
    const [conv] = await this.ds.query('SELECT id, titulo AS title, creada_en AS "createdAt" FROM conversacion WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    if (!conv) throw new NotFoundException('No se encontró la conversación solicitada.');
    return conv;
  }

  async listConversations(user: User) {
    await this.bellai.ensureUser(user);
    return this.ds.query(
      `SELECT c.id, c.titulo AS title, c.creada_en AS "createdAt",
              (SELECT contenido FROM mensaje m WHERE m.conversacion_id = c.id ORDER BY creado_en DESC LIMIT 1) AS "lastMessage",
              (SELECT COUNT(*)::int FROM mensaje m WHERE m.conversacion_id = c.id) AS "messageCount"
       FROM conversacion c WHERE c.usuario_id = $1 ORDER BY c.creada_en DESC LIMIT 50`,
      [user.id],
    );
  }

  async createConversation(user: User, title?: string) {
    await this.bellai.ensureUser(user);
    const [row] = await this.ds.query('INSERT INTO conversacion (usuario_id, titulo) VALUES ($1,$2) RETURNING id, titulo AS title, creada_en AS "createdAt"', [user.id, title?.slice(0, 160) || null]);
    return { ...row, messages: [] };
  }

  async getConversation(user: User, id: string) {
    const conv = await this.conversation(user, id);
    const messages = await this.ds.query('SELECT id, emisor AS sender, contenido AS content, creado_en AS "createdAt" FROM mensaje WHERE conversacion_id = $1 ORDER BY creado_en', [id]);
    return { ...conv, messages };
  }

  async deleteConversation(user: User, id: string) {
    await this.conversation(user, id);
    await this.ds.query('DELETE FROM conversacion WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    await this.audit.record({ actorUserId: user.id, action: 'CONVERSATION_DELETED', entityType: 'conversacion', entityId: id });
    return { deleted: true };
  }

  /**
   * Mensajes para el modelo: prompt con el resumen fijo + lo relevante para los temas de la
   * pregunta, e historial recortado. El resto lo pide el modelo con herramientas.
   */
  private async buildMessages(user: User, conversationId: string, content: string): Promise<{ messages: ChatMessage[]; ctx: UserStyleContext; topics: Topic[] }> {
    const ctx = await this.userContext(user);
    const rows = await this.ds.query(
      `SELECT emisor, contenido FROM (SELECT emisor, contenido, creado_en FROM mensaje WHERE conversacion_id = $1 ORDER BY creado_en DESC LIMIT ${HISTORY_LIMIT}) h ORDER BY creado_en`,
      [conversationId],
    );
    const history = trimHistory(rows.map((m: any) => ({ role: m.emisor === 'usuaria' ? 'user' : 'assistant', content: m.contenido })));
    const topics = detectTopics(content, history.filter((m) => m.role === 'user').map((m) => m.content));
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(ctx, { topics, tools: true }) },
      ...history,
      { role: 'user', content },
    ];
    return { messages, ctx, topics };
  }

  /** Sirve al modelo los datos que pide. Las prendas se leen una sola vez por mensaje y solo si las pide. */
  private toolExecutor(user: User, ctx: UserStyleContext): ToolExecutor {
    let garments: Promise<Garment[]> | null = null;
    const wardrobe = () => (garments ??= this.outfits.wardrobe(user.id));
    return async (name, args) => {
      switch (name) {
        case 'consultar_perfil': {
          const section = String(args.seccion) as (typeof PROFILE_SECTIONS)[number];
          if (!PROFILE_SECTIONS.includes(section)) return { error: `Sección desconocida. Usa una de: ${PROFILE_SECTIONS.join(', ')}.` };
          return { seccion: section, datos: topicSection(section, ctx) ?? 'La usuaria aún no tiene estos datos (no ha hecho ese análisis).' };
        }
        case 'buscar_prendas':
          return searchGarments(await wardrobe(), args);
        case 'proponer_outfits': {
          const temperature = toNumber(args.temperatura_c);
          const rainy = toBool(args.lluvia);
          const r = await this.outfits.generate(user, {
            occasion: typeof args.ocasion === 'string' ? args.ocasion.slice(0, 60) : undefined,
            temperatureC: temperature === undefined ? undefined : Math.max(-40, Math.min(55, temperature)),
            rainy,
            count: Math.min(3, Math.max(1, toNumber(args.cantidad) ?? 2)),
          });
          return {
            prendas_en_armario: r.wardrobeSize,
            // Lo que el motor tuvo en cuenta, para que la respuesta lo mencione
            contexto_aplicado: { ocasion: r.occasion, ...(rainy !== undefined ? { lluvia: rainy } : {}), ...(temperature !== undefined ? { temperatura_c: temperature } : {}) },
            propuestas: r.proposals.map(outfitSummary),
            ...(r.hints.length ? { avisos: r.hints } : {}),
          };
        }
        case 'consultar_combinaciones_guardadas': {
          const saved = await this.outfits.list(user, args.solo_favoritas === true ? true : undefined);
          return {
            total: saved.length,
            combinaciones: saved.slice(0, 6).map((o: any) => ({
              titulo: o.title,
              ocasion: o.occasion,
              favorita: o.favorite,
              valoracion: o.rating,
              prendas: (o.items ?? []).map((i: any) => `${i.name || i.subcategory}${i.color ? ` (${i.color})` : ''}`),
            })),
          };
        }
        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    };
  }

  private async persist(conversationId: string, sender: 'usuaria' | 'asistente', content: string) {
    const [row] = await this.ds.query(
      `INSERT INTO mensaje (conversacion_id, emisor, contenido) VALUES ($1,$2,$3) RETURNING id, emisor AS sender, contenido AS content, creado_en AS "createdAt"`,
      [conversationId, sender, content],
    );
    return row;
  }

  private async autoTitle(conversationId: string, content: string) {
    await this.ds.query(`UPDATE conversacion SET titulo = $2 WHERE id = $1 AND titulo IS NULL`, [conversationId, content.replace(/\s+/g, ' ').slice(0, 60)]);
  }

  /** HU-026 / HU-027: mensaje con respuesta completa. */
  async sendMessage(user: User, conversationId: string, content: string) {
    await this.conversation(user, conversationId);
    await this.usage.consume(user.id, 'assistant_day');
    const { messages, ctx } = await this.buildMessages(user, conversationId, content);
    const message = await this.persist(conversationId, 'usuaria', content);
    await this.autoTitle(conversationId, content);
    const r = await this.llm.converse(messages, { tools: ASSISTANT_TOOLS, execute: this.toolExecutor(user, ctx) });
    const reply = r?.content ?? ruleBasedReply(content, ctx);
    const assistant = await this.persist(conversationId, 'asistente', reply);
    // toolsUsed: qué datos pidió el modelo al backend (p. ej. buscar_prendas), sin sus resultados
    return { message, assistant, engine: engineOf(r), toolsUsed: r?.toolsUsed ?? [] };
  }

  /** Igual que sendMessage pero emitiendo fragmentos a medida que el modelo los genera. */
  async streamMessage(user: User, conversationId: string, content: string, emit: (event: string, data: unknown) => void, signal?: AbortSignal) {
    await this.conversation(user, conversationId);
    await this.usage.consume(user.id, 'assistant_day');
    const { messages, ctx } = await this.buildMessages(user, conversationId, content);
    const message = await this.persist(conversationId, 'usuaria', content);
    await this.autoTitle(conversationId, content);
    emit('message', message);
    let streamed = false;
    const r = await this.llm.converse(messages, {
      tools: ASSISTANT_TOOLS,
      execute: this.toolExecutor(user, ctx),
      signal,
      onToken: (t) => {
        streamed = true;
        emit('token', { t });
      },
    });
    const reply = r?.content ?? ruleBasedReply(content, ctx);
    // Sin modelo, la respuesta de respaldo va de una vez; `done` siempre lleva el texto final completo
    if (!r && !streamed) emit('token', { t: reply });
    const assistant = await this.persist(conversationId, 'asistente', reply);
    emit('done', { assistant, engine: engineOf(r) });
  }

  /** HU-042: explicación natural de un resultado estructurado (recomendación, outfit, compatibilidad…). */
  async explain(user: User, kind: string, data: unknown, question?: string) {
    await this.usage.consume(user.id, 'assistant_day');
    const ctx = await this.userContext(user);
    // Para explicar basta el resumen fijo: el resultado ya trae sus factores
    const r = await this.llm.chat(
      [{ role: 'system', content: systemPrompt(ctx) }, { role: 'user', content: explainPrompt(kind, data, question) }],
      { temperature: 0.3 },
    );
    if (r) return { explanation: r.content, engine: engineOf(r) };
    return { explanation: this.fallbackExplanation(data), engine: 'reglas' };
  }

  private fallbackExplanation(data: any): string {
    const factors: string[] = [];
    const visit = (o: any) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) return o.forEach(visit);
      if (typeof o.rule === 'string') factors.push(`${o.factor ? `${o.factor}: ` : ''}${o.rule}`);
      else if (typeof o.detail === 'string' && o.factor) factors.push(`${o.factor}: ${o.detail}`);
      else if (typeof o.reason === 'string') factors.push(o.reason);
      Object.values(o).forEach((v) => typeof v === 'object' && visit(v));
    };
    visit(data);
    const unique = [...new Set(factors)].slice(0, 4);
    return unique.length ? `Este resultado se basa en: ${unique.join(' ')}` : 'Este resultado combina tu paleta, tu estilo y el contexto que indicaste.';
  }

  status() {
    return this.llm.status();
  }
}
