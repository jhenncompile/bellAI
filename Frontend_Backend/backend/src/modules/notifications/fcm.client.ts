import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import type { PushMessage } from './push.messages';

/**
 * Envío directo por Firebase Cloud Messaging (API HTTP v1) con la cuenta de servicio del proyecto.
 * Sin `firebase-admin`: el JWT se firma con `crypto` de Node y se cambia por un token de acceso
 * de Google, que se reutiliza hasta poco antes de caducar.
 */

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Cuenta de servicio desde FIREBASE_SERVICE_ACCOUNT_JSON (contenido) o FIREBASE_SERVICE_ACCOUNT_PATH (archivo). */
export function loadServiceAccount(json?: string | null, path?: string | null, cwd = process.cwd()): ServiceAccount | null {
  const raw = json?.trim() || (path?.trim() ? readFileSync(isAbsolute(path.trim()) ? path.trim() : resolve(cwd, path.trim()), 'utf8') : null);
  if (!raw) return null;
  const sa = JSON.parse(raw);
  if (!sa?.project_id || !sa?.client_email || !sa?.private_key) throw new Error('La cuenta de servicio de Firebase está incompleta.');
  return { project_id: sa.project_id, client_email: sa.client_email, private_key: String(sa.private_key).replace(/\\n/g, '\n'), token_uri: sa.token_uri };
}

/** JWT firmado (RS256) que Google cambia por un token de acceso. */
export function signedJwt(sa: ServiceAccount, nowS = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || DEFAULT_TOKEN_URI, iat: nowS, exp: nowS + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

/** Cuerpo de messages:send. En FCM `data` solo admite textos. */
export function fcmMessage(token: string, m: PushMessage) {
  const data = Object.fromEntries(Object.entries(m.data).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data,
      android: { priority: 'HIGH', notification: { channel_id: 'avisos', sound: 'default' } },
    },
  };
}

/** El teléfono ya no existe (desinstaló la app o el token caducó): hay que borrarlo. */
export function isDeadFcmToken(status: number, body: any): boolean {
  const code = body?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode ?? body?.error?.status;
  return status === 404 || code === 'UNREGISTERED' || (status === 400 && code === 'INVALID_ARGUMENT');
}

export class FcmClient {
  private access: { token: string; until: number } | null = null;

  constructor(private readonly sa: ServiceAccount) {}

  get projectId() {
    return this.sa.project_id;
  }

  private async accessToken(): Promise<string> {
    if (this.access && Date.now() < this.access.until) return this.access.token;
    const res = await fetch(this.sa.token_uri || DEFAULT_TOKEN_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedJwt(this.sa) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) throw new Error(`Google rechazó la cuenta de servicio (HTTP ${res.status}): ${body.error_description || body.error || ''}`);
    // Un minuto de margen antes de que caduque
    this.access = { token: body.access_token, until: Date.now() + (Number(body.expires_in || 3600) - 60) * 1000 };
    return this.access.token;
  }

  /** Envía a un teléfono. `dead` = el token ya no sirve y hay que borrarlo. */
  async send(token: string, m: PushMessage): Promise<{ ok: boolean; dead: boolean; error?: string }> {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.accessToken()}` },
      body: JSON.stringify(fcmMessage(token, m)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, dead: false };
    const body: any = await res.json().catch(() => ({}));
    return { ok: false, dead: isDeadFcmToken(res.status, body), error: `HTTP ${res.status}: ${body?.error?.message ?? ''}`.slice(0, 200) };
  }
}
