import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type Stripe from 'stripe';
import { User } from '../users/entities/user.entity';
import { AdminAuditService } from '../admin/audit/audit.service';
import { effectivePlan, extendExpiry, periodKey, PLAN_LIMITS } from './plan-limits';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';

/** Esquemas de la app móvil a los que se puede volver después de pagar (evita redirecciones abiertas). */
const APP_RETURN_SCHEMES = ['bellai:', 'exp:', 'exps:'];
const DEFAULT_RETURN_URL = 'bellai://premium';

/** TypeORM devuelve `[filas, afectadas]` en UPDATE ... RETURNING y solo `filas` en SELECT/INSERT. */
function rowsOf<T = any>(result: any): T[] {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
}

export function safeReturnUrl(value?: string | null): string {
  if (!value) return DEFAULT_RETURN_URL;
  try {
    return APP_RETURN_SCHEMES.includes(new URL(value).protocol) ? value : DEFAULT_RETURN_URL;
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

export function appendQuery(url: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
    private readonly usage: UsageService,
    private readonly audit: AdminAuditService,
  ) {}

  price() {
    const amountCents = Number(this.config.get('PREMIUM_PRICE_CENTS') ?? 4900);
    const currency = String(this.config.get('PREMIUM_CURRENCY') ?? 'bob').toLowerCase();
    const days = Number(this.config.get('PREMIUM_DAYS') ?? 30);
    const symbol = currency === 'bob' ? 'Bs' : currency.toUpperCase();
    return { amountCents, currency, days, label: `${symbol} ${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)}` };
  }

  /** Plan efectivo, vencimiento, precio y uso actual de la usuaria. */
  async status(userId: string, now: Date = new Date()) {
    const [row] = await this.ds.query('SELECT plan, plan_expires_at AS "planExpiresAt" FROM users WHERE id = $1', [userId]);
    if (!row) throw new NotFoundException('Usuario no encontrado');
    const plan = effectivePlan(row, now);
    return {
      plan,
      isPremium: plan === 'premium',
      planExpiresAt: plan === 'premium' ? new Date(row.planExpiresAt).toISOString() : null,
      price: this.price(),
      limits: PLAN_LIMITS,
      usage: await this.usage.summary(userId, plan, now),
      payments: { enabled: this.stripe.isConfigured(), testMode: this.stripe.isTestMode() },
    };
  }

  /** Crea el pago pendiente y la sesión de Stripe Checkout. Devuelve la URL a abrir en el navegador. */
  async createCheckout(user: User, returnUrl?: string) {
    const price = this.price();
    const app = safeReturnUrl(returnUrl);
    const [payment] = await this.ds.query(
      `INSERT INTO payments (user_id, provider, amount_cents, currency) VALUES ($1, 'stripe', $2, $3) RETURNING id`,
      [user.id, price.amountCents, price.currency],
    );
    const base = this.publicApiUrl();
    try {
      const session = await this.stripe.createCheckoutSession({
        paymentId: payment.id,
        userId: user.id,
        email: user.email,
        amountCents: price.amountCents,
        currency: price.currency,
        productName: `BellAI Premium · ${price.days} días`,
        successUrl: `${base}/api/subscriptions/return?status=success&session_id={CHECKOUT_SESSION_ID}&app=${encodeURIComponent(app)}`,
        cancelUrl: `${base}/api/subscriptions/return?status=cancel&app=${encodeURIComponent(app)}`,
      });
      await this.ds.query('UPDATE payments SET provider_session_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [payment.id, session.id]);
      return { paymentId: payment.id, sessionId: session.id, url: session.url, testMode: this.stripe.isTestMode() };
    } catch (err) {
      await this.ds.query(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [payment.id]);
      throw err;
    }
  }

  /**
   * Respaldo del webhook: al volver a la app se consulta la sesión en Stripe.
   * Así el pago se confirma aunque el webhook no llegue (por ejemplo, en local sin el CLI de Stripe).
   */
  async confirm(user: User, sessionId: string) {
    const [payment] = await this.ds.query('SELECT id, status FROM payments WHERE provider_session_id = $1 AND user_id = $2', [sessionId, user.id]);
    if (!payment) throw new NotFoundException('No encontramos ese pago.');
    let status: string = payment.status;
    if (status === 'pending') {
      const session = await this.stripe.retrieveSession(sessionId);
      if (session.paymentStatus === 'paid') {
        await this.activate(sessionId);
        status = 'paid';
      } else if (session.status === 'expired') {
        await this.markStatus(sessionId, 'expired');
        status = 'expired';
      }
    }
    return { paymentStatus: status, subscription: await this.status(user.id) };
  }

  /** Eventos de Stripe que nos importan. Todo lo demás se ignora. */
  async handleEvent(event: Pick<Stripe.Event, 'type' | 'data'>) {
    const session = event.data.object as Stripe.Checkout.Session;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (session.payment_status === 'paid') await this.activate(session.id);
        break;
      case 'checkout.session.async_payment_failed':
        await this.markStatus(session.id, 'failed');
        break;
      case 'checkout.session.expired':
        await this.markStatus(session.id, 'expired');
        break;
    }
    return { received: true };
  }

  /**
   * Marca el pago como pagado y suma los días de Premium. Idempotente: si el webhook y
   * `confirm` llegan a la vez (o Stripe reintenta), solo el primero activa.
   */
  async activate(sessionId: string, now: Date = new Date()): Promise<{ activated: boolean; planExpiresAt?: string }> {
    const { days } = this.price();
    const result = await this.ds.transaction(async (m) => {
      const [payment] = rowsOf(
        await m.query(
          `UPDATE payments SET status = 'paid', paid_at = $2, updated_at = CURRENT_TIMESTAMP
           WHERE provider_session_id = $1 AND status = 'pending'
           RETURNING id, user_id AS "userId"`,
          [sessionId, now],
        ),
      );
      if (!payment) return { activated: false };
      const [user] = await m.query('SELECT plan, plan_expires_at AS "planExpiresAt" FROM users WHERE id = $1 FOR UPDATE', [payment.userId]);
      const current = effectivePlan(user, now) === 'premium' ? user.planExpiresAt : null;
      const expiresAt = extendExpiry(current, days, now);
      await m.query(`UPDATE users SET plan = 'premium', plan_expires_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [payment.userId, expiresAt]);
      await m.query('UPDATE payments SET period_end = $2 WHERE id = $1', [payment.id, expiresAt]);
      return { activated: true, planExpiresAt: expiresAt.toISOString(), paymentId: payment.id, userId: payment.userId };
    });
    if (result.activated) {
      const { paymentId, userId, ...rest } = result as any;
      this.logger.log(`Premium activado para ${userId} hasta ${rest.planExpiresAt}`);
      await this.audit
        .record({ actorUserId: userId, action: 'SUBSCRIPTION_ACTIVATED', entityType: 'payment', entityId: paymentId, changes: { planExpiresAt: rest.planExpiresAt } })
        .catch(() => undefined);
      return rest;
    }
    return { activated: false };
  }

  private async markStatus(sessionId: string, status: 'failed' | 'expired') {
    await this.ds.query(
      `UPDATE payments SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE provider_session_id = $1 AND status = 'pending'`,
      [sessionId, status],
    );
  }

  /** Página intermedia: Stripe solo redirige a http(s), y desde aquí se vuelve a la app. */
  returnPage(status: string, sessionId: string | undefined, app: string | undefined): { deepLink: string; html: string } {
    const ok = status === 'success';
    const params: Record<string, string> = { status: ok ? 'success' : 'cancel' };
    if (ok && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) params.session_id = sessionId;
    const deepLink = appendQuery(safeReturnUrl(app), params);
    const safeLink = deepLink.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const title = ok ? '¡Pago recibido!' : 'Pago cancelado';
    const text = ok ? 'Estamos activando tu plan Premium.' : 'No se realizó ningún cobro.';
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${safeLink}"><title>BellAI</title>
<style>body{font-family:system-ui,sans-serif;background:#fdf7f9;color:#2b2230;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center}a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:12px;background:#b04a7a;color:#fff;text-decoration:none;font-weight:600}</style>
</head><body><main><h1>${title}</h1><p>${text}</p><a href="${safeLink}">Volver a BellAI</a></main></body></html>`;
    return { deepLink, html };
  }

  /** Panel admin: pagos recientes y cifras básicas. */
  async adminOverview(now: Date = new Date()) {
    const month = periodKey('simulations_month', now);
    const [stats] = await this.ds.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE plan = 'premium' AND plan_expires_at > $1) AS "activeSubscribers",
         (SELECT COUNT(*)::int FROM payments WHERE status = 'pending') AS "pendingPayments",
         (SELECT COALESCE(SUM(amount_cents), 0)::int FROM payments
           WHERE status = 'paid' AND to_char(paid_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM') = $2) AS "monthRevenueCents"`,
      [now, month],
    );
    const payments = await this.ds.query(
      `SELECT p.id, p.status, p.amount_cents AS "amountCents", p.currency, p.provider, p.paid_at AS "paidAt",
              p.period_end AS "periodEnd", p.created_at AS "createdAt", u.name AS "userName", u.email AS "userEmail"
       FROM payments p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 100`,
    );
    return { ...stats, currency: this.price().currency, testMode: this.stripe.isTestMode(), payments };
  }

  private publicApiUrl(): string {
    const url = this.config.get<string>('PUBLIC_API_URL') || `http://localhost:${this.config.get('PORT') || 8000}`;
    if (!/^https?:\/\//.test(url)) throw new BadRequestException('PUBLIC_API_URL debe empezar por http:// o https://');
    return url.replace(/\/$/, '');
  }
}
