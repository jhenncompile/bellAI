import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { BellaiService } from '../bellai/bellai.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import {
  DIMENSION_LABELS, DNA_DIMENSIONS, DnaDimension, DnaSources, DnaVector, FeedbackValue, MIN_WARDROBE_ITEMS, NEUTRAL_DNA, REASON_LABELS,
  average, changeReason, sameVector, closestStyles, combine, contributions, declaredVector, dimensionChanges, inferredVector, learn, styleVector,
  topDimensions, wardrobeVector, collapseHistory, predominantDimensions,
} from './style-dna';
import { garmentDna, Garment } from '../outfits/outfit.engine';
import { recommend, RULES_VERSION } from './recommendation.engine';
import { FeedbackDto } from './style.dto';

@Injectable()
export class StyleService {
  constructor(
    private readonly ds: DataSource,
    private readonly bellai: BellaiService,
    private readonly audit: AdminAuditService,
  ) {}

  async preferences(userId: string): Promise<any> {
    const [row] = await this.ds.query('SELECT style_preferences AS sp FROM preferences WHERE user_id = $1', [userId]);
    return row?.sp || {};
  }

  async latestDiagnosis(userId: string): Promise<any | null> {
    const [row] = await this.ds.query('SELECT resultado_detallado AS d FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1', [userId]);
    return row?.d && Object.keys(row.d).length ? row.d : null;
  }

  /** HU-13: ADN de cada prenda confirmada del armario (tipo + estilo que vio la IA) y cuánto la usa. */
  async wardrobeGarments(userId: string): Promise<{ dna: DnaVector; wearCount: number }[]> {
    const rows = await this.ds.query(
      `SELECT subcategory, wear_count AS "wearCount", ai_metadata->'styles' AS styles
       FROM wardrobe_items WHERE user_id = $1 AND status = 'confirmed'`,
      [userId],
    );
    return rows.map((r: any) => ({
      dna: garmentDna({ subcategory: r.subcategory, styles: Array.isArray(r.styles) ? r.styles : [] } as Garment),
      wearCount: Number(r.wearCount) || 0,
    }));
  }

  /**
   * Guarda un punto del historial. Varios cambios seguidos por el mismo motivo (p. ej. valorar diez
   * recomendaciones) se funden en un solo punto durante 30 minutos para que la evolución sea legible.
   */
  private async recordHistory(userId: string, dimensions: DnaVector, reason: string) {
    // La pantalla pide perfil y recomendaciones a la vez: el bloqueo por usuaria evita dos puntos iguales
    await this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`perfil_dna:${userId}`]);
      const [latest] = await m.query(
        `SELECT id, dimensiones, motivo, creado_en > CURRENT_TIMESTAMP - INTERVAL '30 minutes' AS reciente
         FROM perfil_dna_historial WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1`,
        [userId],
      );
      // Sin cambio respecto al último punto no hay nada que contar en la evolución
      if (latest && sameVector(latest.dimensiones, dimensions)) return;
      if (latest && latest.motivo === reason && latest.reciente) {
        await m.query('UPDATE perfil_dna_historial SET dimensiones = $2::jsonb, creado_en = CURRENT_TIMESTAMP WHERE id = $1', [latest.id, JSON.stringify(dimensions)]);
      } else {
        await m.query('INSERT INTO perfil_dna_historial (usuario_id, dimensiones, motivo) VALUES ($1,$2::jsonb,$3)', [userId, JSON.stringify(dimensions), reason]);
      }
    });
  }

  private async dnaRow(userId: string) {
    const [row] = await this.ds.query('SELECT dimensiones, fuentes, interacciones, actualizado_en FROM perfil_dna WHERE usuario_id = $1', [userId]);
    return row || null;
  }

  /** Calcula (y persiste si cambió) el Style DNA de la usuaria. */
  /** `reason`: motivo del cambio cuando lo sabe quien llama (p. ej. una valoración ya guardada). */
  async computeDna(user: User, reason?: string) {
    await this.bellai.ensureUser(user);
    const [prefs, diagnosis, row, garments] = await Promise.all([
      this.preferences(user.id), this.latestDiagnosis(user.id), this.dnaRow(user.id), this.wardrobeGarments(user.id),
    ]);
    const interactions = Number(row?.interacciones || 0);
    const sources: DnaSources = {
      declared: declaredVector(prefs.preferredStyles, prefs.dislikedStyles),
      inferred: inferredVector(diagnosis),
      learned: (row?.fuentes?.learned as DnaVector) || null,
      wardrobe: wardrobeVector(garments),
    };
    const wardrobeItems = garments.length;
    const dimensions = combine(sources, interactions, wardrobeItems);
    if (!row || !sameVector(row.dimensiones, dimensions)) {
      await this.ds.query(
        `INSERT INTO perfil_dna (usuario_id, dimensiones, fuentes, interacciones) VALUES ($1,$2::jsonb,$3::jsonb,$4)
         ON CONFLICT (usuario_id) DO UPDATE SET dimensiones = EXCLUDED.dimensiones, fuentes = EXCLUDED.fuentes, actualizado_en = CURRENT_TIMESTAMP`,
        [user.id, JSON.stringify(dimensions), JSON.stringify({ ...sources, wardrobeItems }), interactions],
      );
      await this.recordHistory(user.id, dimensions, reason ?? changeReason(row?.fuentes, sources));
    }
    return { dimensions, sources, interactions, wardrobeItems, diagnosis, prefs };
  }

  async getDna(user: User, reason?: string) {
    const { dimensions, sources, interactions, wardrobeItems } = await this.computeDna(user, reason);
    // Sin ninguna fuente el perfil es neutro (todo 50): no se inventan dimensiones «predominantes»
    const hasData = Boolean(sources.declared || sources.inferred || sources.learned || sources.wardrobe);
    const history = await this.ds.query(
      'SELECT dimensiones AS dimensions, motivo AS reason, creado_en AS "createdAt" FROM perfil_dna_historial WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 20',
      [user.id],
    );
    // Evolución (HU-13): del primer punto de los últimos 90 días a hoy
    const [first] = await this.ds.query(
      `SELECT dimensiones AS dimensions, creado_en AS "createdAt" FROM perfil_dna_historial
       WHERE usuario_id = $1 AND creado_en > CURRENT_TIMESTAMP - INTERVAL '90 days' ORDER BY creado_en ASC LIMIT 1`,
      [user.id],
    );
    const wardrobeLine = sources.wardrobe
      ? `Las ${wardrobeItems} prendas de tu armario (las que más usas cuentan más).`
      : wardrobeItems
        ? `Registra al menos ${MIN_WARDROBE_ITEMS} prendas para que tu armario también cuente.`
        : 'Registra prendas en tu armario para que el perfil aprenda de lo que usas.';
    return {
      dimensions,
      labels: DIMENSION_LABELS,
      hasData,
      top: hasData ? topDimensions(dimensions, 3) : [],
      closestStyles: hasData ? closestStyles(dimensions, 3) : [],
      interactions,
      sources: {
        declared: Boolean(sources.declared),
        inferred: Boolean(sources.inferred),
        learned: Boolean(sources.learned),
        wardrobe: Boolean(sources.wardrobe),
      },
      contributions: contributions(sources, interactions, wardrobeItems),
      wardrobeItems,
      evolution: {
        since: first?.createdAt ?? null,
        changes: first ? dimensionChanges(first.dimensions, dimensions) : [],
        timeline: collapseHistory(history as { dimensions: DnaVector; reason: string; createdAt: string }[]).slice(0, 10).map((h) => ({
          at: h.createdAt,
          reason: h.reason,
          reasonLabel: REASON_LABELS[h.reason] ?? REASON_LABELS.recalculo,
          // Vacío si en ese momento el perfil era neutro: la app muestra «Perfil equilibrado»
          top: predominantDimensions(h.dimensions, 2),
        })),
      },
      explanation: [
        sources.declared ? 'Tus estilos preferidos (lo que declaras tiene prioridad).' : 'Aún no elegiste estilos preferidos.',
        sources.inferred ? 'Tu diagnóstico de imagen (contraste, rostro y silueta).' : 'Haz tu diagnóstico para afinar el perfil.',
        wardrobeLine,
        interactions ? `${interactions} valoraciones de recomendaciones y outfits.` : 'Valora recomendaciones para que aprenda de tus gustos.',
      ],
      history,
    };
  }

  private async feedbackMap(userId: string, targetType?: string): Promise<Record<string, string>> {
    const rows = await this.ds.query(
      `SELECT objetivo_id AS id, valor AS value FROM retroalimentacion WHERE usuario_id = $1 AND ($2::text IS NULL OR objetivo_tipo = $2)`,
      [userId, targetType || null],
    );
    return Object.fromEntries(rows.map((r: any) => [r.id, r.value]));
  }

  async recommendations(user: User, occasion?: string, type?: string) {
    const { dimensions, diagnosis, prefs } = await this.computeDna(user);
    const items = recommend({
      diagnosis,
      preferences: prefs,
      dna: dimensions,
      occasion: occasion || null,
      feedback: await this.feedbackMap(user.id, 'recomendacion'),
    }).filter((r) => !type || r.type === type);
    return {
      rulesVersion: RULES_VERSION,
      diagnosisAvailable: Boolean(diagnosis),
      hint: diagnosis ? null : 'Haz tu diagnóstico de rostro y cuerpo para recibir recomendaciones de colores, cortes y prendas.',
      occasion: occasion || null,
      count: items.length,
      items,
    };
  }

  /** Estilo medio de unas prendas del armario (null si ninguna es suya). */
  private async itemsVector(userId: string, itemIds: string[]): Promise<DnaVector | null> {
    const rows = await this.ds.query(
      `SELECT subcategory, ai_metadata->'styles' AS styles FROM wardrobe_items WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [userId, itemIds],
    );
    return average(rows.map((r: any) => garmentDna({ subcategory: r.subcategory, styles: Array.isArray(r.styles) ? r.styles : [] } as Garment)));
  }

  /** Vector objetivo del elemento valorado, a partir de sus atributos. */
  private targetVector(attrs: FeedbackDto['attributes']): DnaVector | null {
    if (!attrs) return null;
    if (attrs.dna && typeof attrs.dna === 'object') {
      const out = { ...NEUTRAL_DNA };
      for (const d of DNA_DIMENSIONS) if (typeof (attrs.dna as any)[d] === 'number') out[d] = (attrs.dna as any)[d];
      return out;
    }
    if (attrs.styles?.length) {
      const vec = average(attrs.styles.map(styleVector).filter(Boolean) as DnaVector[]);
      if (vec) return vec;
    }
    if (attrs.dimension && (DNA_DIMENSIONS as readonly string[]).includes(attrs.dimension)) {
      return { ...NEUTRAL_DNA, [attrs.dimension as DnaDimension]: 90 };
    }
    return null;
  }

  /** HU-018 / HU-039: guardar la valoración y aprender de ella. */
  async feedback(user: User, dto: FeedbackDto) {
    await this.bellai.ensureUser(user);
    await this.ds.query(
      `INSERT INTO retroalimentacion (usuario_id, objetivo_tipo, objetivo_id, valor, atributos) VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (usuario_id, objetivo_tipo, objetivo_id) DO UPDATE SET valor = EXCLUDED.valor, atributos = EXCLUDED.atributos, actualizado_en = CURRENT_TIMESTAMP`,
      [user.id, dto.targetType, dto.targetId, dto.value, JSON.stringify(dto.attributes || {})],
    );
    if (dto.targetType === 'outfit' && /^[0-9a-f-]{36}$/i.test(dto.targetId)) {
      const rating = { me_gusta: 'agradable', neutral: 'neutral', no_me_gusta: 'no_agradable' }[dto.value];
      await this.ds.query('UPDATE outfit SET valoracion = $3 WHERE id = $1 AND usuario_id = $2', [dto.targetId, user.id, rating]);
    }
    // Sin vector explícito, el estilo se deduce de las prendas de la combinación (HU-23)
    const target = this.targetVector(dto.attributes) ?? (dto.attributes?.itemIds?.length ? await this.itemsVector(user.id, dto.attributes.itemIds) : null);
    let learnedApplied = false;
    if (target && dto.value !== 'neutral') {
      const row = await this.dnaRow(user.id);
      const interactions = Number(row?.interacciones || 0);
      const base: DnaVector = row?.fuentes?.learned || row?.fuentes?.declared || row?.dimensiones || NEUTRAL_DNA;
      const learned = learn(base, target, dto.value as FeedbackValue, interactions);
      const sources = { ...(row?.fuentes || {}), learned };
      await this.ds.query(
        `INSERT INTO perfil_dna (usuario_id, dimensiones, fuentes, interacciones) VALUES ($1,$2::jsonb,$3::jsonb,1)
         ON CONFLICT (usuario_id) DO UPDATE SET fuentes = EXCLUDED.fuentes, interacciones = perfil_dna.interacciones + 1, actualizado_en = CURRENT_TIMESTAMP`,
        [user.id, JSON.stringify(row?.dimensiones || NEUTRAL_DNA), JSON.stringify(sources)],
      );
      learnedApplied = true;
    }
    await this.audit.record({ actorUserId: user.id, action: 'STYLE_FEEDBACK', entityType: dto.targetType, entityId: dto.targetId.slice(0, 100), changes: { value: dto.value } });
    const dna = await this.getDna(user, learnedApplied ? 'valoraciones' : undefined);
    return { saved: true, learned: learnedApplied, dna: { dimensions: dna.dimensions, top: dna.top, interactions: dna.interactions } };
  }

  async listFeedback(user: User, targetType?: string) {
    return this.ds.query(
      `SELECT objetivo_tipo AS "targetType", objetivo_id AS "targetId", valor AS value, atributos AS attributes, actualizado_en AS "updatedAt"
       FROM retroalimentacion WHERE usuario_id = $1 AND ($2::text IS NULL OR objetivo_tipo = $2) ORDER BY actualizado_en DESC LIMIT 200`,
      [user.id, targetType || null],
    );
  }

  /** HU-028: historial unificado de diagnósticos, valoraciones, outfits, simulaciones y conversaciones. */
  async history(user: User, kind?: string, limit = 50) {
    const lim = Math.min(200, Math.max(1, limit));
    const rows = await this.ds.query(
      `SELECT * FROM (
         SELECT 'diagnostico' AS kind, id::text AS id, creado_en AS at, COALESCE(paleta_estacional, 'Diagnóstico') AS title, resumen AS detail FROM diagnostico WHERE usuario_id = $1
         UNION ALL
         SELECT 'valoracion', objetivo_id, actualizado_en, objetivo_tipo || ': ' || valor, NULL FROM retroalimentacion WHERE usuario_id = $1
         UNION ALL
         SELECT 'outfit', id::text, creado_en, COALESCE(titulo, 'Outfit'), explicacion FROM outfit WHERE usuario_id = $1
         UNION ALL
         SELECT 'simulacion', id::text, creada_en, tipo, NULL FROM simulacion WHERE usuario_id = $1
         UNION ALL
         SELECT 'conversacion', id::text, creada_en, COALESCE(titulo, 'Conversación con el asistente'), NULL FROM conversacion WHERE usuario_id = $1
       ) h WHERE ($2::text IS NULL OR kind = $2) ORDER BY at DESC LIMIT ${lim}`,
      [user.id, kind || null],
    );
    return rows.map((r: any) => ({ kind: r.kind, id: r.id, at: r.at, title: r.title, detail: r.detail }));
  }
}
