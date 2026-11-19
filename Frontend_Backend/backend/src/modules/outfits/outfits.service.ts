import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StyleService } from '../style/style.service';
import { WeatherService, WeatherSnapshot } from '../weather/weather.service';
import { BellaiService } from '../bellai/bellai.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { normalizeOccasion } from '../style/recommendation.engine';
import { Garment, garmentDna, generateOutfits, OUTFIT_ENGINE_VERSION, OutfitContext, scoreOutfit, summarizeComparison } from './outfit.engine';
import { CompareOutfitsDto, GenerateOutfitsDto, OutfitContextDto, SaveOutfitDto, UpdateOutfitDto } from './outfits.dto';
import { itemSetKey, OutfitRating, RATING_TO_FEEDBACK } from './outfit-ratings';
import { average } from '../style/style-dna';
import { buildFeedbackProfile, FeedbackProfile, FeedbackValue } from './feedback-profile';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { signMediaPath } from '../../common/media/signed-url';

const OCCASION_TABLE: Record<string, string> = { casual: 'Casual', trabajo: 'Trabajo', entrevista: 'Trabajo', formal: 'Formal', fiesta: 'Fiesta', deporte: 'Deporte', playa: 'Playa', gala: 'Gala' };

@Injectable()
export class OutfitsService {
  constructor(
    private readonly ds: DataSource,
    private readonly style: StyleService,
    private readonly weather: WeatherService,
    private readonly bellai: BellaiService,
    private readonly audit: AdminAuditService,
  ) {}

  async wardrobe(userId: string): Promise<Garment[]> {
    const rows = await this.ds.query(
      `SELECT id, name, category, subcategory, color, color_hex, season, occasion, wear_count, last_worn_at, enhanced_image_url, original_image_url,
              ai_metadata->>'pattern' AS pattern, ai_metadata->'styles' AS styles, ai_metadata->>'suggestedOccasion' AS ai_occasion
       FROM wardrobe_items WHERE user_id = $1 AND status = 'confirmed'`,
      [userId],
    );
    return rows.map((r: any) => ({
      id: r.id, name: r.name, category: r.category, subcategory: r.subcategory, color: r.color, colorHex: r.color_hex,
      season: r.season, occasion: r.occasion, wearCount: Number(r.wear_count || 0),
      lastWornAt: r.last_worn_at ? new Date(r.last_worn_at).toISOString() : null,
      imageUrl: signMediaPath(r.enhanced_image_url || r.original_image_url || null),
      pattern: r.pattern || null,
      styles: Array.isArray(r.styles) ? r.styles : [],
      aiOccasion: r.ai_occasion || null,
    }));
  }

  private async resolveWeather(dto: OutfitContextDto): Promise<WeatherSnapshot | null> {
    if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number') {
      try {
        return await this.weather.current(dto.latitude, dto.longitude);
      } catch {
        if (typeof dto.temperatureC !== 'number') return null;
      }
    }
    if (typeof dto.temperatureC === 'number') return this.weather.manual(dto.temperatureC, Boolean(dto.rainy));
    return null;
  }

  /** Contexto común (HU-037/038): paleta, preferencias, Style DNA, clima y valoraciones. */
  async buildContext(user: User, dto: OutfitContextDto): Promise<{ ctx: OutfitContext; weather: WeatherSnapshot | null; hasDiagnosis: boolean; diagnosis: any | null }> {
    const { dimensions, diagnosis, prefs } = await this.style.computeDna(user);
    const weather = await this.resolveWeather(dto);
    const fb = await this.ds.query(
      `SELECT objetivo_tipo AS t, objetivo_id AS id, valor AS v, atributos->'itemIds' AS "itemIds"
       FROM retroalimentacion WHERE usuario_id = $1 AND objetivo_tipo IN ('outfit','prenda')
       ORDER BY actualizado_en LIMIT 500`,
      [user.id],
    );
    const feedback = await this.feedbackProfile(user.id, fb);
    const set = (t: string, v: string) => new Set<string>(fb.filter((r: any) => r.t === t && r.v === v).map((r: any) => r.id));
    const rec = diagnosis?.recommendations?.colors ?? {};
    return {
      hasDiagnosis: Boolean(diagnosis),
      diagnosis,
      weather,
      ctx: {
        occasion: dto.occasion || null,
        temperatureC: weather?.temperatureC ?? null,
        rainy: weather?.rainy ?? Boolean(dto.rainy),
        palette: diagnosis?.palette ?? [...(rec.recommended ?? []), ...(rec.accents ?? []), ...(rec.neutrals ?? [])],
        avoidColors: rec.avoid ?? [],
        declaredAvoid: prefs.avoidedColors ?? [],
        declaredPreferred: prefs.preferredColors ?? [],
        dna: dimensions,
        budgetPerGarment: dto.budgetPerGarment ?? prefs.budgetPerGarment ?? null,
        dislikedOutfits: set('outfit', 'no_me_gusta'),
        likedOutfits: set('outfit', 'me_gusta'),
        dislikedGarments: set('prenda', 'no_me_gusta'),
        likedGarments: set('prenda', 'me_gusta'),
        feedback,
      },
    };
  }

  /**
   * HU-23: perfil de gustos con todas sus valoraciones: prendas sueltas, combinaciones guardadas
   * (`outfit.valoracion`) y combinaciones valoradas sin guardar (con sus prendas en `atributos.itemIds`).
   * Las valoraciones de un outfit guardado se leen de la tabla `outfit`, que es la fuente.
   */
  private async feedbackProfile(userId: string, fb: { t: string; id: string; v: FeedbackValue; itemIds: unknown }[]): Promise<FeedbackProfile> {
    const saved = await this.ds.query(
      `SELECT o.valoracion AS rating, array_agg(oi.wardrobe_item_id::text) AS "itemIds"
       FROM outfit o JOIN outfit_item oi ON oi.outfit_id = o.id
       WHERE o.usuario_id = $1 AND o.valoracion IS NOT NULL
       GROUP BY o.id ORDER BY MAX(o.creado_en)`,
      [userId],
    );
    const unsaved = fb
      .filter((r) => r.t === 'outfit' && !UUID.test(r.id) && Array.isArray(r.itemIds) && r.itemIds.length)
      .map((r) => ({ itemIds: (r.itemIds as unknown[]).map(String), value: r.v }));
    const wardrobe = await this.ds.query('SELECT id, name, color, color_hex AS "colorHex", subcategory FROM wardrobe_items WHERE user_id = $1', [userId]);
    return buildFeedbackProfile({
      // Primero las no guardadas y luego las guardadas: si es la misma combinación, manda la guardada
      outfits: [...unsaved, ...saved.map((s: any) => ({ itemIds: s.itemIds, value: RATING_TO_FEEDBACK[s.rating as OutfitRating] }))],
      garments: fb.filter((r) => r.t === 'prenda').map((r) => ({ id: r.id, value: r.v })),
      wardrobe,
    });
  }

  async generate(user: User, dto: GenerateOutfitsDto) {
    const wardrobe = await this.wardrobe(user.id);
    const { ctx, weather, hasDiagnosis } = await this.buildContext(user, dto);
    const proposals = generateOutfits(wardrobe, ctx, dto.count || 3);
    const hints: string[] = [];
    if (!wardrobe.length) hints.push('Tu armario está vacío. Registra algunas prendas para generar outfits.');
    if (!hasDiagnosis) hints.push('Con tu diagnóstico de color las combinaciones serán más precisas.');
    if (!weather) hints.push('Activa la ubicación o indica la temperatura para tener en cuenta el clima.');
    return {
      engineVersion: OUTFIT_ENGINE_VERSION,
      occasion: dto.occasion || null,
      weather,
      wardrobeSize: wardrobe.length,
      hints,
      proposals,
    };
  }

  /** HU-017: comparar varias combinaciones con el mismo contexto. */
  async compare(user: User, dto: CompareOutfitsDto) {
    const wardrobe = await this.wardrobe(user.id);
    const byId = new Map(wardrobe.map((g) => [g.id, g]));
    const { ctx, weather } = await this.buildContext(user, dto);
    const results = dto.outfits.map((o, index) => {
      const items = o.itemIds.map((id) => byId.get(id)).filter(Boolean) as Garment[];
      if (items.length !== o.itemIds.length) throw new BadRequestException(`La opción ${index + 1} incluye prendas que no están en tu armario.`);
      const scored = scoreOutfit(items.map((g) => ({ ...g, role: g.subcategory === 'vestidos' ? 'vestido' : g.category })), ctx);
      return { index, title: o.title || `Opción ${index + 1}`, ...scored };
    });
    // HU-21: motivo de cada opción (fuertes y débiles) y por qué gana la más conveniente
    const summary = summarizeComparison(results);
    return {
      weather,
      occasion: dto.occasion || null,
      results: results.map((r, pos) => ({ ...r, ...summary.perOption[pos] })),
      winner: summary.winner,
      comparison: summary.rows,
    };
  }

  async save(user: User, dto: SaveOutfitDto) {
    await this.bellai.ensureUser(user);
    const owned = await this.ds.query('SELECT id FROM wardrobe_items WHERE user_id = $1 AND id = ANY($2::uuid[])', [user.id, dto.itemIds]);
    if (owned.length !== new Set(dto.itemIds).size) throw new BadRequestException('Algunas prendas no pertenecen a tu armario.');
    // HU-22: la misma combinación no se guarda dos veces; se actualiza la que ya estaba
    const existing = await this.findSaved(user.id, dto.itemIds);
    if (existing) {
      if (dto.favorite !== undefined || dto.rating !== undefined) await this.update(user, existing, { favorite: dto.favorite, rating: dto.rating });
      return { ...(await this.get(user, existing)), alreadySaved: true };
    }
    const occ = normalizeOccasion(dto.occasion);
    const [occRow] = occ && OCCASION_TABLE[occ] ? await this.ds.query('SELECT id FROM ocasion WHERE nombre = $1', [OCCASION_TABLE[occ]]) : [null];
    const [outfit] = await this.ds.query(
      `INSERT INTO outfit (usuario_id, ocasion_id, titulo, explicacion, clima_resumen, temperatura_c, guardado, favorito, puntuacion, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9::jsonb) RETURNING id, creado_en AS "createdAt"`,
      [user.id, occRow?.id ?? null, dto.title || null, dto.explanation || null, dto.weatherSummary || null, dto.temperatureC ?? null,
        Boolean(dto.favorite), dto.score !== undefined ? Math.round(dto.score * 100) : null, JSON.stringify({ ...(dto.details || {}), occasion: dto.occasion || null })],
    );
    for (const id of new Set(dto.itemIds)) {
      await this.ds.query('INSERT INTO outfit_item (outfit_id, wardrobe_item_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [outfit.id, id]);
    }
    await this.audit.record({ actorUserId: user.id, action: 'OUTFIT_SAVED', entityType: 'outfit', entityId: outfit.id });
    if (dto.rating) await this.applyRating(user, outfit.id, dto.rating);
    return { ...(await this.get(user, outfit.id)), alreadySaved: false };
  }

  /** Outfit guardado con exactamente estas prendas, si lo hay. El orden de uuid coincide con el de `itemSetKey`. */
  private async findSaved(userId: string, itemIds: string[]): Promise<string | null> {
    const [row] = await this.ds.query(
      `SELECT o.id FROM outfit o JOIN outfit_item oi ON oi.outfit_id = o.id
       WHERE o.usuario_id = $1 AND o.guardado
       GROUP BY o.id HAVING string_agg(oi.wardrobe_item_id::text, ',' ORDER BY oi.wardrobe_item_id) = $2
       ORDER BY o.creado_en LIMIT 1`,
      [userId, itemSetKey(itemIds)],
    );
    return row?.id ?? null;
  }

  /**
   * HU-22: valoración agradable / neutral / no agradable. Pasa por `/style/feedback` para que
   * también ajuste las recomendaciones (HU-23); repetir la misma valoración no vuelve a aprender.
   */
  private async applyRating(user: User, id: string, rating: OutfitRating | null) {
    const [current] = await this.ds.query('SELECT valoracion FROM outfit WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    if ((current?.valoracion ?? null) === rating) return;
    if (rating === null) {
      await this.ds.query('UPDATE outfit SET valoracion = NULL WHERE id = $1 AND usuario_id = $2', [id, user.id]);
      await this.ds.query(`DELETE FROM retroalimentacion WHERE usuario_id = $1 AND objetivo_tipo = 'outfit' AND objetivo_id = $2`, [user.id, id]);
      return;
    }
    const itemIds: string[] = (await this.ds.query('SELECT wardrobe_item_id AS id FROM outfit_item WHERE outfit_id = $1', [id])).map((r: any) => r.id);
    const garments = (await this.wardrobe(user.id)).filter((g) => itemIds.includes(g.id));
    const dna = garments.length ? average(garments.map(garmentDna)) : null;
    await this.style.feedback(user, { targetType: 'outfit', targetId: id, value: RATING_TO_FEEDBACK[rating], attributes: dna ? { dna } : undefined });
  }

  private readonly listSql = `
    SELECT o.id, o.titulo AS title, o.explicacion AS explanation, o.clima_resumen AS "weatherSummary", o.temperatura_c AS "temperatureC",
           o.favorito AS favorite, o.valoracion AS rating, o.puntuacion AS score, o.detalles AS details, o.creado_en AS "createdAt",
           oc.nombre AS occasion,
           COALESCE(json_agg(json_build_object('id', w.id, 'name', w.name, 'category', w.category, 'subcategory', w.subcategory,
             'color', w.color, 'colorHex', w.color_hex, 'imageUrl', COALESCE(w.enhanced_image_url, w.original_image_url)))
             FILTER (WHERE w.id IS NOT NULL), '[]') AS items
    FROM outfit o
    LEFT JOIN ocasion oc ON oc.id = o.ocasion_id
    LEFT JOIN outfit_item oi ON oi.outfit_id = o.id
    LEFT JOIN wardrobe_items w ON w.id = oi.wardrobe_item_id`;

  async list(user: User, favorites?: boolean, rating?: OutfitRating) {
    const rows = await this.ds.query(
      `${this.listSql} WHERE o.usuario_id = $1 AND ($2::boolean IS NULL OR o.favorito = $2) AND ($3::text IS NULL OR o.valoracion = $3)
       GROUP BY o.id, oc.nombre ORDER BY o.favorito DESC, o.creado_en DESC LIMIT 100`,
      [user.id, favorites ?? null, rating ?? null],
    );
    return rows.map((r: any) => ({ ...r, items: this.signItems(r.items), score: r.score === null ? null : Number(r.score) / 100, temperatureC: r.temperatureC === null ? null : Number(r.temperatureC) }));
  }

  async get(user: User, id: string) {
    const [row] = await this.ds.query(`${this.listSql} WHERE o.usuario_id = $1 AND o.id = $2 GROUP BY o.id, oc.nombre`, [user.id, id]);
    if (!row) throw new NotFoundException('No se encontró el outfit.');
    return { ...row, items: this.signItems(row.items), score: row.score === null ? null : Number(row.score) / 100 };
  }

  private signItems(items: any[] = []) {
    return items.map((i) => ({ ...i, imageUrl: signMediaPath(i.imageUrl) }));
  }

  async update(user: User, id: string, dto: UpdateOutfitDto) {
    await this.get(user, id);
    await this.ds.query('UPDATE outfit SET titulo = COALESCE($3, titulo), favorito = COALESCE($4, favorito) WHERE id = $1 AND usuario_id = $2', [id, user.id, dto.title ?? null, dto.favorite ?? null]);
    if (dto.rating !== undefined) await this.applyRating(user, id, dto.rating);
    return this.get(user, id);
  }

  async remove(user: User, id: string) {
    await this.get(user, id);
    await this.ds.query('DELETE FROM outfit WHERE id = $1 AND usuario_id = $2', [id, user.id]);
    await this.audit.record({ actorUserId: user.id, action: 'OUTFIT_DELETED', entityType: 'outfit', entityId: id });
    return { deleted: true };
  }

  /** Registrar que se usó el outfit: suma un uso a cada prenda (rotación del armario). */
  async wear(user: User, id: string) {
    await this.get(user, id);
    await this.ds.query(
      `UPDATE wardrobe_items SET wear_count = wear_count + 1, last_worn_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND id IN (SELECT wardrobe_item_id FROM outfit_item WHERE outfit_id = $2)`,
      [user.id, id],
    );
    return { worn: true };
  }
}
