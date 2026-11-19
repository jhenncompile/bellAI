import { HttpException, HttpStatus } from '@nestjs/common';

export type PlanCode = 'free' | 'premium';
export type Feature = 'assistant_day' | 'simulations_month' | 'wardrobe_items';

export const FEATURES: readonly Feature[] = ['assistant_day', 'simulations_month', 'wardrobe_items'];

/** Topes por plan. `null` = sin límite. Ver documentacion/bellai/09 Producto/Plan de Suscripciones.md */
export const PLAN_LIMITS: Record<PlanCode, Record<Feature, number | null>> = {
  free: { assistant_day: 5, simulations_month: 3, wardrobe_items: 50 },
  premium: { assistant_day: 40, simulations_month: 30, wardrobe_items: null },
};

export const FEATURE_LABELS: Record<Feature, string> = {
  assistant_day: 'mensajes al asistente de hoy',
  simulations_month: 'simulaciones de este mes',
  wardrobe_items: 'prendas en tu armario',
};

/** Bolivia es UTC-4 todo el año (sin horario de verano): los días y meses se cortan a medianoche de La Paz. */
const BOLIVIA_OFFSET_MS = -4 * 60 * 60 * 1000;

/** Clave del periodo del contador: '2026-11-18' (por día), '2026-11' (por mes) o 'total'. */
export function periodKey(feature: Feature, now: Date = new Date()): string {
  const local = new Date(now.getTime() + BOLIVIA_OFFSET_MS).toISOString();
  if (feature === 'assistant_day') return local.slice(0, 10);
  if (feature === 'simulations_month') return local.slice(0, 7);
  return 'total';
}

export interface PlanHolder {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
}

/** Plan que rige ahora: un Premium vencido (o sin fecha) vale como Gratis. Así no hace falta tarea programada. */
export function effectivePlan(user: PlanHolder | null | undefined, now: Date = new Date()): PlanCode {
  if (!user || user.plan !== 'premium' || !user.planExpiresAt) return 'free';
  return new Date(user.planExpiresAt).getTime() > now.getTime() ? 'premium' : 'free';
}

/** Un pago suma `days` días desde hoy o desde el vencimiento vigente, lo que sea más tarde. */
export function extendExpiry(current: Date | string | null | undefined, days: number, now: Date = new Date()): Date {
  const base = current && new Date(current).getTime() > now.getTime() ? new Date(current) : now;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/** HTTP 402: la usuaria llegó al tope de su plan. La app lo usa para llevarla a la pantalla Premium. */
export class PlanLimitException extends HttpException {
  constructor(feature: Feature, limit: number, plan: PlanCode) {
    const upsell = plan === 'free' ? ' Hazte Premium para tener más.' : ' Vuelve a intentarlo en el próximo periodo.';
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'PLAN_LIMIT',
        feature,
        limit,
        plan,
        message: `Llegaste al límite de ${limit} ${FEATURE_LABELS[feature]}.${upsell}`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
