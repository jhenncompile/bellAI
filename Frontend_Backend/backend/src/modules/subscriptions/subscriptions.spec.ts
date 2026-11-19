import { HttpStatus } from '@nestjs/common';
import { effectivePlan, extendExpiry, periodKey, PLAN_LIMITS, PlanLimitException } from './plan-limits';
import { UsageService } from './usage.service';
import { appendQuery, safeReturnUrl, SubscriptionsService } from './subscriptions.service';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-18T15:00:00Z');

/** DataSource falso: responde según el SQL y guarda cada consulta para inspeccionarla. */
function fakeDs(handler: (sql: string, params: any[]) => any) {
  const calls: { sql: string; params: any[] }[] = [];
  const query = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    return handler(sql, params);
  };
  return { calls, query, transaction: async (fn: any) => fn({ query }) } as any;
}

describe('Suscripciones · reglas del plan', () => {
  it('corta los periodos a medianoche de Bolivia (UTC-4)', () => {
    // 02:00 UTC del 19/11 todavía es 18/11 en La Paz
    const lateNight = new Date('2026-11-19T02:00:00Z');
    expect(periodKey('assistant_day', lateNight)).toBe('2026-11-18');
    expect(periodKey('simulations_month', new Date('2026-12-01T03:59:00Z'))).toBe('2026-11');
    expect(periodKey('simulations_month', new Date('2026-12-01T04:00:00Z'))).toBe('2026-12');
    expect(periodKey('wardrobe_items', NOW)).toBe('total');
  });

  it('un Premium vencido o sin fecha vale como Gratis', () => {
    expect(effectivePlan({ plan: 'premium', planExpiresAt: new Date(NOW.getTime() + DAY) }, NOW)).toBe('premium');
    expect(effectivePlan({ plan: 'premium', planExpiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe('free');
    expect(effectivePlan({ plan: 'premium', planExpiresAt: null }, NOW)).toBe('free');
    expect(effectivePlan({ plan: 'free', planExpiresAt: new Date(NOW.getTime() + DAY) }, NOW)).toBe('free');
    expect(effectivePlan(undefined, NOW)).toBe('free');
  });

  it('renovar antes de vencer suma los días al vencimiento vigente', () => {
    const in5days = new Date(NOW.getTime() + 5 * DAY);
    expect(extendExpiry(in5days, 30, NOW).getTime()).toBe(NOW.getTime() + 35 * DAY);
  });

  it('si ya venció, los 30 días cuentan desde hoy', () => {
    const expired = new Date(NOW.getTime() - 10 * DAY);
    expect(extendExpiry(expired, 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(extendExpiry(null, 30, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('el 402 lleva el código PLAN_LIMIT y un mensaje en español', () => {
    const err = new PlanLimitException('simulations_month', 3, 'free');
    const body: any = err.getResponse();
    expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(body).toMatchObject({ code: 'PLAN_LIMIT', feature: 'simulations_month', limit: 3, plan: 'free' });
    expect(body.message).toContain('Hazte Premium');
  });

  it('Premium tiene topes más altos que Gratis y armario sin límite', () => {
    expect(PLAN_LIMITS.premium.assistant_day).toBeGreaterThan(PLAN_LIMITS.free.assistant_day);
    expect(PLAN_LIMITS.premium.simulations_month).toBeGreaterThan(PLAN_LIMITS.free.simulations_month);
    expect(PLAN_LIMITS.premium.wardrobe_items).toBeNull();
  });
});

describe('Suscripciones · UsageService', () => {
  const premiumRow = { plan: 'premium', planExpiresAt: new Date(NOW.getTime() + DAY) };

  it('cuenta el uso con el tope del plan Gratis', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('SELECT plan') ? [{ plan: 'free' }] : [{ count: 2 }]));
    await expect(new UsageService(ds).consume('u1', 'assistant_day', NOW)).resolves.toBe(2);
    const insert = ds.calls.find((c: any) => c.sql.includes('INSERT INTO usage_counters'));
    expect(insert.params).toEqual(['u1', 'assistant_day', '2026-11-18', PLAN_LIMITS.free.assistant_day]);
  });

  it('lanza 402 cuando la base no deja incrementar (ya llegó al tope)', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('SELECT plan') ? [{ plan: 'free' }] : []));
    await expect(new UsageService(ds).consume('u1', 'simulations_month', NOW)).rejects.toBeInstanceOf(PlanLimitException);
  });

  it('Premium vigente usa el tope de Premium', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('SELECT plan') ? [premiumRow] : [{ count: 1 }]));
    await new UsageService(ds).consume('u1', 'simulations_month', NOW);
    const insert = ds.calls.find((c: any) => c.sql.includes('INSERT INTO usage_counters'));
    expect(insert.params).toEqual(['u1', 'simulations_month', '2026-11', PLAN_LIMITS.premium.simulations_month]);
  });

  it('bloquea una prenda nueva con el armario lleno en Gratis', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('SELECT plan') ? [{ plan: 'free' }] : [{ n: PLAN_LIMITS.free.wardrobe_items }]));
    await expect(new UsageService(ds).assertCanAddWardrobeItem('u1', NOW)).rejects.toBeInstanceOf(PlanLimitException);
  });

  it('Premium no cuenta prendas (sin límite)', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('SELECT plan') ? [premiumRow] : [{ n: 9999 }]));
    await expect(new UsageService(ds).assertCanAddWardrobeItem('u1', NOW)).resolves.toBeUndefined();
    expect(ds.calls.some((c: any) => c.sql.includes('wardrobe_items'))).toBe(false);
  });

  it('resume el uso de cada función frente a su tope', async () => {
    const ds = fakeDs((sql) => {
      if (sql.includes('FROM usage_counters')) return [{ feature: 'assistant_day', count: 4 }];
      if (sql.includes('FROM wardrobe_items')) return [{ n: 12 }];
      return [];
    });
    const usage = await new UsageService(ds).summary('u1', 'free', NOW);
    expect(usage).toEqual({
      assistant_day: { used: 4, limit: 5 },
      simulations_month: { used: 0, limit: 3 },
      wardrobe_items: { used: 12, limit: 50 },
    });
  });
});

describe('Suscripciones · pagos', () => {
  const config = { get: (k: string) => ({ PREMIUM_PRICE_CENTS: '4900', PREMIUM_CURRENCY: 'bob', PREMIUM_DAYS: '30', PUBLIC_API_URL: 'http://api.test' } as any)[k] };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
  const stripe = (over: Partial<Record<string, any>> = {}) =>
    ({ isConfigured: () => true, isTestMode: () => true, createCheckoutSession: jest.fn(), retrieveSession: jest.fn(), ...over }) as any;
  const usage = { summary: jest.fn().mockResolvedValue({}) } as any;

  /** Base en memoria mínima para el flujo de activación. */
  function paymentsDb(initial: { status: string; userPlan?: any }) {
    const state = { payment: { id: 'p1', userId: 'u1', status: initial.status, periodEnd: null as Date | null }, user: initial.userPlan ?? { plan: 'free', planExpiresAt: null } };
    const ds = fakeDs((sql, params) => {
      if (sql.includes('UPDATE payments SET status = \'paid\'')) {
        if (state.payment.status !== 'pending') return [[], 0];
        state.payment.status = 'paid';
        return [[{ id: 'p1', userId: 'u1' }], 1];
      }
      if (sql.includes('FOR UPDATE')) return [state.user];
      if (sql.startsWith('UPDATE users')) {
        state.user = { plan: 'premium', planExpiresAt: params[1] };
        return [[], 1];
      }
      if (sql.includes('SET period_end')) state.payment.periodEnd = params[1];
      if (sql.includes('SET status = $2')) {
        if (state.payment.status === 'pending') state.payment.status = params[1];
        return [[], 1];
      }
      if (sql.startsWith('SELECT id, status FROM payments')) return [{ id: 'p1', status: state.payment.status }];
      if (sql.startsWith('SELECT plan')) return [state.user];
      return [];
    });
    return { ds, state };
  }

  it('activar un pago da 30 días de Premium', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    const service = new SubscriptionsService(ds, config as any, stripe(), usage, audit);
    const res = await service.activate('cs_test_1', NOW);
    expect(res.activated).toBe(true);
    expect(state.user.plan).toBe('premium');
    expect(new Date(state.user.planExpiresAt).getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(state.payment.periodEnd).toEqual(state.user.planExpiresAt);
  });

  it('es idempotente: el mismo pago no suma días dos veces', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    const service = new SubscriptionsService(ds, config as any, stripe(), usage, audit);
    await service.activate('cs_test_1', NOW);
    const first = state.user.planExpiresAt;
    const again = await service.activate('cs_test_1', NOW);
    expect(again.activated).toBe(false);
    expect(state.user.planExpiresAt).toEqual(first);
  });

  it('renovar con Premium vigente suma 30 días al vencimiento actual', async () => {
    const current = new Date(NOW.getTime() + 10 * DAY);
    const { ds, state } = paymentsDb({ status: 'pending', userPlan: { plan: 'premium', planExpiresAt: current } });
    await new SubscriptionsService(ds, config as any, stripe(), usage, audit).activate('cs_test_1', NOW);
    expect(new Date(state.user.planExpiresAt).getTime()).toBe(NOW.getTime() + 40 * DAY);
  });

  it('el webhook checkout.session.completed activa solo si está pagado', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    const service = new SubscriptionsService(ds, config as any, stripe(), usage, audit);
    await service.handleEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'unpaid' } } } as any);
    expect(state.payment.status).toBe('pending');
    await service.handleEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid' } } } as any);
    expect(state.payment.status).toBe('paid');
  });

  it('el webhook checkout.session.expired marca el pago como vencido', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    await new SubscriptionsService(ds, config as any, stripe(), usage, audit).handleEvent({ type: 'checkout.session.expired', data: { object: { id: 'cs_test_1' } } } as any);
    expect(state.payment.status).toBe('expired');
    expect(state.user.plan).toBe('free');
  });

  it('confirm consulta Stripe y activa si la sesión está pagada (respaldo del webhook)', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    const s = stripe({ retrieveSession: jest.fn().mockResolvedValue({ id: 'cs_test_1', paymentStatus: 'paid', status: 'complete' }) });
    const res = await new SubscriptionsService(ds, config as any, s, usage, audit).confirm({ id: 'u1' } as any, 'cs_test_1');
    expect(res.paymentStatus).toBe('paid');
    expect(state.user.plan).toBe('premium');
  });

  it('una tarjeta rechazada deja el plan en Gratis', async () => {
    const { ds, state } = paymentsDb({ status: 'pending' });
    const s = stripe({ retrieveSession: jest.fn().mockResolvedValue({ id: 'cs_test_1', paymentStatus: 'unpaid', status: 'open' }) });
    const res = await new SubscriptionsService(ds, config as any, s, usage, audit).confirm({ id: 'u1' } as any, 'cs_test_1');
    expect(res.paymentStatus).toBe('pending');
    expect(state.user.plan).toBe('free');
  });

  it('checkout crea el pago pendiente y la sesión con Bs 49 y la URL de retorno', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('INSERT INTO payments') ? [{ id: 'p1' }] : []));
    const createCheckoutSession = jest.fn().mockResolvedValue({ id: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' });
    const service = new SubscriptionsService(ds, config as any, stripe({ createCheckoutSession }), usage, audit);
    const res = await service.createCheckout({ id: 'u1', email: 'a@b.c' } as any, 'exp://192.168.0.5:8081/--/premium');
    expect(res).toMatchObject({ sessionId: 'cs_test_9', url: 'https://checkout.stripe.com/c/pay/cs_test_9' });
    const input = createCheckoutSession.mock.calls[0][0];
    expect(input).toMatchObject({ amountCents: 4900, currency: 'bob', paymentId: 'p1' });
    expect(input.successUrl).toBe(
      'http://api.test/api/subscriptions/return?status=success&session_id={CHECKOUT_SESSION_ID}&app=' + encodeURIComponent('exp://192.168.0.5:8081/--/premium'),
    );
    expect(ds.calls.some((c: any) => c.sql.includes('SET provider_session_id'))).toBe(true);
  });

  it('si Stripe falla, el pago queda como fallido', async () => {
    const ds = fakeDs((sql) => (sql.startsWith('INSERT INTO payments') ? [{ id: 'p1' }] : []));
    const service = new SubscriptionsService(ds, config as any, stripe({ createCheckoutSession: jest.fn().mockRejectedValue(new Error('red')) }), usage, audit);
    await expect(service.createCheckout({ id: 'u1' } as any)).rejects.toThrow('red');
    expect(ds.calls.some((c: any) => c.sql.includes("status = 'failed'"))).toBe(true);
  });

  it('solo vuelve a esquemas de la app (sin redirecciones abiertas)', () => {
    expect(safeReturnUrl('bellai://premium')).toBe('bellai://premium');
    expect(safeReturnUrl('exp://192.168.0.5:8081/--/premium')).toBe('exp://192.168.0.5:8081/--/premium');
    expect(safeReturnUrl('https://evil.example')).toBe('bellai://premium');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('bellai://premium');
    expect(safeReturnUrl(undefined)).toBe('bellai://premium');
    expect(appendQuery('bellai://premium', { status: 'success' })).toBe('bellai://premium?status=success');
  });

  it('la página de retorno arma el deep link y escapa el HTML', () => {
    const service = new SubscriptionsService({} as any, config as any, stripe(), usage, audit);
    const ok = service.returnPage('success', 'cs_test_abc', 'bellai://premium');
    expect(ok.deepLink).toBe('bellai://premium?status=success&session_id=cs_test_abc');
    expect(ok.html).toContain('bellai://premium?status=success&amp;session_id=cs_test_abc');
    const bad = service.returnPage('success', '"><script>', 'https://evil.example');
    expect(bad.deepLink).toBe('bellai://premium?status=success');
    expect(bad.html).not.toContain('<script>');
  });
});
