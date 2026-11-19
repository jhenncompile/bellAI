import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { effectivePlan, Feature, FEATURES, periodKey, PlanCode, PLAN_LIMITS, PlanLimitException } from './plan-limits';

export interface FeatureUsage {
  used: number;
  limit: number | null;
}

/**
 * Topes de uso por plan. Los mensajes y simulaciones se cuentan en `usage_counters`
 * por periodo; las prendas se cuentan directamente en `wardrobe_items`.
 */
@Injectable()
export class UsageService {
  constructor(private readonly ds: DataSource) {}

  async planOf(userId: string, now: Date = new Date()): Promise<PlanCode> {
    const [row] = await this.ds.query('SELECT plan, plan_expires_at AS "planExpiresAt" FROM users WHERE id = $1', [userId]);
    return effectivePlan(row, now);
  }

  /**
   * Registra un uso. Lanza 402 `PLAN_LIMIT` si ya se llegó al tope.
   * El incremento es atómico: dos peticiones simultáneas no pueden pasarse del tope.
   */
  async consume(userId: string, feature: Exclude<Feature, 'wardrobe_items'>, now: Date = new Date()): Promise<number> {
    const plan = await this.planOf(userId, now);
    const limit = PLAN_LIMITS[plan][feature];
    if (limit !== null && limit <= 0) throw new PlanLimitException(feature, limit, plan);
    const rows = await this.ds.query(
      `INSERT INTO usage_counters (user_id, feature, period_key, count) VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, feature, period_key)
       DO UPDATE SET count = usage_counters.count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE $4::int IS NULL OR usage_counters.count < $4::int
       RETURNING count`,
      [userId, feature, periodKey(feature, now), limit],
    );
    if (!rows.length) throw new PlanLimitException(feature, limit, plan);
    return Number(rows[0].count);
  }

  /** Antes de crear una prenda: 402 si el armario ya está lleno para el plan. */
  async assertCanAddWardrobeItem(userId: string, now: Date = new Date()): Promise<void> {
    const plan = await this.planOf(userId, now);
    const limit = PLAN_LIMITS[plan].wardrobe_items;
    if (limit === null) return;
    const used = await this.wardrobeCount(userId);
    if (used >= limit) throw new PlanLimitException('wardrobe_items', limit, plan);
  }

  /** Uso actual de cada función frente al tope del plan. */
  async summary(userId: string, plan: PlanCode, now: Date = new Date()): Promise<Record<Feature, FeatureUsage>> {
    const keys = FEATURES.filter((f) => f !== 'wardrobe_items');
    const rows: { feature: string; count: number }[] = await this.ds.query(
      `SELECT feature, count FROM usage_counters WHERE user_id = $1 AND (feature, period_key) IN (${keys
        .map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ')})`,
      [userId, ...keys.flatMap((f) => [f, periodKey(f, now)])],
    );
    const counts = new Map(rows.map((r) => [r.feature, Number(r.count)]));
    const result = {} as Record<Feature, FeatureUsage>;
    for (const f of FEATURES) {
      const used = f === 'wardrobe_items' ? await this.wardrobeCount(userId) : counts.get(f) ?? 0;
      result[f] = { used, limit: PLAN_LIMITS[plan][f] };
    }
    return result;
  }

  private async wardrobeCount(userId: string): Promise<number> {
    const [row] = await this.ds.query('SELECT COUNT(*)::int AS n FROM wardrobe_items WHERE user_id = $1', [userId]);
    return Number(row?.n ?? 0);
  }
}
