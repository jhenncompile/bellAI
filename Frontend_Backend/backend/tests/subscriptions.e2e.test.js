'use strict';

/**
 * E2E de suscripciones contra una API real con su base PostgreSQL.
 * Se omite si no se define E2E_API_URL. Ejemplo:
 *
 *   # API con STRIPE_SECRET_KEY=sk_test_... y STRIPE_WEBHOOK_SECRET=whsec_e2e
 *   E2E_API_URL=http://localhost:8000 E2E_DATABASE_URL=postgres://postgres@localhost:5432/bellia \
 *   STRIPE_WEBHOOK_SECRET=whsec_e2e node --test tests/subscriptions.e2e.test.js
 *
 * No llama a Stripe: crea el pago pendiente en la base (como haría /checkout) y envía
 * el webhook `checkout.session.completed` firmado con el mismo secreto que la API.
 */
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { Client } = require('pg');
const Stripe = require('stripe');

const API = process.env.E2E_API_URL;
const DB_URL = process.env.E2E_DATABASE_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_e2e';
const skip = !API || !DB_URL ? 'Define E2E_API_URL y E2E_DATABASE_URL para correr el E2E de suscripciones' : false;

let db;
let token;
let userId;
let conversationId;
const email = `e2e.premium.${Date.now()}@bellia.test`;

async function http(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const sendMessage = (n) => http('POST', `/api/assistant/conversations/${conversationId}/messages`, { content: `¿Qué me pongo hoy? (${n})` });

function signedWebhook(sessionId, paymentStatus = 'paid') {
  const payload = JSON.stringify({
    id: `evt_e2e_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, object: 'checkout.session', payment_status: paymentStatus, status: 'complete' } },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

before(async () => {
  if (skip) return;
  db = new Client({ connectionString: DB_URL });
  await db.connect();
  const reg = await http('POST', '/api/auth/register', { name: 'E2E Premium', email, password: 'Clave-segura-123' });
  assert.ok([200, 201].includes(reg.status), `registro: ${reg.status} ${JSON.stringify(reg.body)}`);
  const login = await http('POST', '/api/auth/login', { email, password: 'Clave-segura-123' });
  assert.ok([200, 201].includes(login.status), `login: ${login.status} ${JSON.stringify(login.body)}`);
  token = login.body.access_token || login.body.accessToken || login.body.token;
  assert.ok(token, 'el login devuelve un token');
  const [row] = (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows;
  userId = row.id;
  const conv = await http('POST', '/api/assistant/conversations', { title: 'E2E' });
  assert.ok([200, 201].includes(conv.status), `conversación: ${conv.status} ${JSON.stringify(conv.body)}`);
  conversationId = conv.body.id;
});

after(async () => {
  if (db) {
    await db.query('DELETE FROM users WHERE email = $1', [email]);
    await db.end();
  }
});

test('una usuaria nueva está en el plan Gratis', { skip }, async () => {
  const me = await http('GET', '/api/subscriptions/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.plan, 'free');
  assert.equal(me.body.planExpiresAt, null);
  assert.equal(me.body.price.amountCents, 4900);
  assert.equal(me.body.usage.assistant_day.limit, 5);
});

test('Gratis: 5 mensajes al día y el 6.º responde 402 PLAN_LIMIT', { skip }, async () => {
  for (let i = 1; i <= 5; i++) {
    const r = await sendMessage(i);
    assert.ok([200, 201].includes(r.status), `mensaje ${i}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  const blocked = await sendMessage(6);
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.code, 'PLAN_LIMIT');
  assert.equal(blocked.body.feature, 'assistant_day');
  const me = await http('GET', '/api/subscriptions/me');
  assert.equal(me.body.usage.assistant_day.used, 5);
});

test('el webhook sin firma válida se rechaza', { skip }, async () => {
  const { payload } = signedWebhook('cs_test_falso');
  const r = await http('POST', '/api/subscriptions/webhook', payload, { 'Stripe-Signature': 't=1,v1=firmafalsa' });
  assert.equal(r.status, 400);
});

test('pago aprobado por webhook: Premium 30 días y vuelve a poder escribir', { skip }, async () => {
  const sessionId = `cs_test_e2e_${Date.now()}`;
  await db.query(`INSERT INTO payments (user_id, provider, provider_session_id, amount_cents, currency) VALUES ($1, 'stripe', $2, 4900, 'bob')`, [userId, sessionId]);
  const { payload, header } = signedWebhook(sessionId);
  const hook = await http('POST', '/api/subscriptions/webhook', payload, { 'Stripe-Signature': header });
  assert.equal(hook.status, 200, JSON.stringify(hook.body));

  const me = await http('GET', '/api/subscriptions/me');
  assert.equal(me.body.plan, 'premium');
  const days = (new Date(me.body.planExpiresAt).getTime() - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days <= 30, `vence en ${days} días`);
  assert.equal(me.body.usage.assistant_day.limit, 40);

  const r = await sendMessage(7);
  assert.ok([200, 201].includes(r.status), `con Premium: ${r.status}`);

  // Stripe reintenta el mismo evento: no suma otros 30 días
  const again = signedWebhook(sessionId);
  await http('POST', '/api/subscriptions/webhook', again.payload, { 'Stripe-Signature': again.header });
  const me2 = await http('GET', '/api/subscriptions/me');
  assert.equal(me2.body.planExpiresAt, me.body.planExpiresAt);

  const [payment] = (await db.query('SELECT status, period_end FROM payments WHERE provider_session_id = $1', [sessionId])).rows;
  assert.equal(payment.status, 'paid');
  assert.equal(new Date(payment.period_end).toISOString(), me.body.planExpiresAt);
});

test('al vencer, vuelve a Gratis sin tareas programadas', { skip }, async () => {
  await db.query(`UPDATE users SET plan_expires_at = now() - interval '1 minute' WHERE id = $1`, [userId]);
  const me = await http('GET', '/api/subscriptions/me');
  assert.equal(me.body.plan, 'free');
  const blocked = await sendMessage(8);
  assert.equal(blocked.status, 402);
});

test('la página de retorno devuelve a la app y no a otros sitios', { skip }, async () => {
  const ok = await fetch(`${API}/api/subscriptions/return?status=success&session_id=cs_test_abc&app=${encodeURIComponent('bellai://premium')}`);
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /bellai:\/\/premium\?status=success&amp;session_id=cs_test_abc/);
  const evil = await fetch(`${API}/api/subscriptions/return?status=success&app=${encodeURIComponent('https://evil.example')}`);
  assert.doesNotMatch(await evil.text(), /evil\.example/);
});

test('un error de la pasarela nunca responde 401 (cerraría la sesión de la app)', { skip }, async () => {
  const r = await http('POST', '/api/subscriptions/checkout', {});
  // Con una clave sk_test_ real responde 201 con la URL de Stripe; con una clave falsa o sin red, 502.
  assert.ok([201, 502].includes(r.status), `checkout: ${r.status} ${JSON.stringify(r.body)}`);
  if (r.status === 201) assert.match(r.body.url, /^https:\/\/checkout\.stripe\.com\//);
  else {
    const [p] = (await db.query(`SELECT status FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId])).rows;
    assert.equal(p.status, 'failed');
  }
});

test('solo admin o manager ven el panel de pagos', { skip }, async () => {
  const r = await http('GET', '/api/admin/payments');
  assert.equal(r.status, 403);
});
