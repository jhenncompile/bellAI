import { generateKeyPairSync, createVerify } from 'crypto';
import { deadTokens, expoPayload, isExpoPushToken, isPushToken, taskFinishedMessage } from './push.messages';
import { FcmClient, fcmMessage, isDeadFcmToken, loadServiceAccount, signedJwt } from './fcm.client';
import { NotificationsService } from './notifications.service';

const TOKEN = 'ExponentPushToken[abc123]';
const FCM_TOKEN = 'd' + 'A1b2C3_d4-E5:'.repeat(12);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA_JSON = JSON.stringify({ project_id: 'proyecto-prueba', client_email: 'push@proyecto-prueba.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() });

describe('Notificaciones push', () => {
  describe('textos', () => {
    it('anuncia el diagnóstico con la estación y abre el estudio', () => {
      const m = taskFinishedMessage('diagnostico', 'completada', { season: 'Otoño cálido', faceShape: 'Ovalado' }, null);
      expect(m).toEqual({ title: 'Tu diagnóstico está listo', body: 'Eres Otoño cálido. Mira tu paleta y lo que mejor te queda.', data: { url: '/studio', kind: 'analisis_listo' } });
    });

    it('sin estación no inventa una', () => {
      expect(taskFinishedMessage('diagnostico', 'completada', { season: null }, null)?.body).toBe('Mira tu paleta y lo que mejor te queda.');
    });

    it('si falla, lleva el motivo que ve la usuaria', () => {
      const m = taskFinishedMessage('diagnostico', 'fallida', null, 'La foto está muy oscura.');
      expect(m?.title).toBe('No pudimos terminar tu análisis');
      expect(m?.body).toBe('La foto está muy oscura.');
    });

    it('las simulaciones dicen qué se simuló; otros tipos no avisan', () => {
      expect(taskFinishedMessage('simulacion', 'completada', {}, null, { kind: 'corte_cabello' })?.body).toBe('Ya puedes ver cómo te queda tu nuevo corte.');
      expect(taskFinishedMessage('otra_cosa', 'completada', {}, null)).toBeNull();
    });
  });

  describe('formato de Expo', () => {
    it('solo acepta tokens de Expo', () => {
      expect(isExpoPushToken(TOKEN)).toBe(true);
      expect(isExpoPushToken('ExpoPushToken[x]')).toBe(true);
      expect(isExpoPushToken('fcm:123')).toBe(false);
      expect(isExpoPushToken(42)).toBe(false);
    });

    it('arma un mensaje por teléfono con el canal de Android', () => {
      const [p] = expoPayload([TOKEN], { title: 't', body: 'b', data: { url: '/studio', kind: 'k' } });
      expect(p).toMatchObject({ to: TOKEN, title: 't', body: 'b', channelId: 'avisos', data: { url: '/studio' } });
    });

    it('detecta los teléfonos que ya no existen', () => {
      expect(deadTokens(['a', 'b', 'c'], [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }])).toEqual(['b']);
    });
  });

  describe('Firebase (FCM v1)', () => {
    it('acepta tokens nativos de Firebase además de los de Expo', () => {
      expect(isPushToken(FCM_TOKEN)).toBe(true);
      expect(isPushToken('corto')).toBe(false);
      expect(isPushToken('con espacios '.repeat(10))).toBe(false);
    });

    it('firma un JWT RS256 válido con la cuenta de servicio', () => {
      const sa = loadServiceAccount(SA_JSON)!;
      expect(sa.private_key).toContain('-----BEGIN PRIVATE KEY-----\n');
      const [h, c, sig] = signedJwt(sa, 1000).split('.');
      const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
      expect(claims).toMatchObject({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: 1000, exp: 4600 });
      const v = createVerify('RSA-SHA256');
      v.update(`${h}.${c}`);
      expect(v.verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    });

    it('arma el mensaje con datos en texto y el canal de Android', () => {
      const m = fcmMessage(FCM_TOKEN, { title: 't', body: 'b', data: { url: '/studio', kind: 'k', taskId: 't1', vacio: undefined } as any });
      expect(m.message.data).toEqual({ url: '/studio', kind: 'k', taskId: 't1' });
      expect(m.message.android.notification.channel_id).toBe('avisos');
    });

    it('reconoce los tokens que hay que borrar', () => {
      expect(isDeadFcmToken(404, {})).toBe(true);
      expect(isDeadFcmToken(400, { error: { status: 'INVALID_ARGUMENT' } })).toBe(true);
      expect(isDeadFcmToken(400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
      expect(isDeadFcmToken(503, { error: { status: 'UNAVAILABLE' } })).toBe(false);
    });

    it('reutiliza el token de acceso de Google entre envíos', async () => {
      const realFetch = global.fetch;
      const calls: string[] = [];
      global.fetch = jest.fn(async (url: any) => {
        calls.push(String(url));
        return String(url).includes('oauth2') ? { ok: true, json: async () => ({ access_token: 'acceso', expires_in: 3600 }) } : { ok: true, json: async () => ({ name: 'm1' }) };
      }) as any;
      try {
        const fcm = new FcmClient(loadServiceAccount(SA_JSON)!);
        await fcm.send(FCM_TOKEN, { title: 't', body: 'b', data: { url: '/', kind: 'k' } });
        expect(await fcm.send(FCM_TOKEN, { title: 't', body: 'b', data: { url: '/', kind: 'k' } })).toEqual({ ok: true, dead: false });
        expect(calls.filter((u) => u.includes('oauth2'))).toHaveLength(1);
        expect(calls[1]).toBe('https://fcm.googleapis.com/v1/projects/proyecto-prueba/messages:send');
      } finally {
        global.fetch = realFetch;
      }
    });
  });

  describe('NotificationsService', () => {
    const realFetch = global.fetch;
    afterEach(() => { global.fetch = realFetch; });

    const make = (rows: { wants?: boolean | null; tokens?: string[] }, env: Record<string, string> = {}) => {
      const queries: { sql: string; params: any[] }[] = [];
      const db = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          queries.push({ sql, params });
          if (sql.includes('FROM preferences')) return rows.wants === null ? [] : [{ push_notifications: rows.wants ?? true }];
          if (sql.startsWith('SELECT token')) return (rows.tokens ?? []).map((token) => ({ token }));
          return [];
        }),
      };
      let listener: any;
      const tasks = { onFinished: (l: any) => { listener = l; } };
      const service = new NotificationsService(db as any, tasks as any, { get: (k: string) => env[k] } as any);
      service.onModuleInit();
      return { service, queries, finish: (e: any) => listener(e) };
    };

    it('al terminar un diagnóstico avisa a sus teléfonos y borra los que ya no existen', async () => {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }) })) as any;
      const { queries, finish } = make({ tokens: [TOKEN, 'ExponentPushToken[viejo]'] });
      await finish({ taskId: 't1', userId: 'u1', type: 'diagnostico', status: 'completada', result: { season: 'Invierno frío' }, error: null });

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://exp.host/--/api/v2/push/send');
      const body = JSON.parse(init.body);
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ to: TOKEN, title: 'Tu diagnóstico está listo', data: { url: '/studio', taskId: 't1' } });
      expect(queries.find((q) => q.sql.startsWith('DELETE FROM push_token WHERE token = ANY'))?.params).toEqual([['ExponentPushToken[viejo]']]);
    });

    it('no envía nada si la usuaria desactivó las notificaciones', async () => {
      global.fetch = jest.fn() as any;
      const { service } = make({ wants: false, tokens: [TOKEN] });
      expect(await service.sendToUser('u1', { title: 't', body: 'b', data: { url: '/', kind: 'k' } })).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sin fila de preferencias, vale el valor por defecto (activadas)', async () => {
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) })) as any;
      const { service } = make({ wants: null, tokens: [TOKEN] });
      expect(await service.sendToUser('u1', { title: 't', body: 'b', data: { url: '/', kind: 'k' } })).toBe(1);
    });

    it('PUSH_DISABLED=true apaga los envíos', async () => {
      global.fetch = jest.fn() as any;
      const { service } = make({ tokens: [TOKEN] }, { PUSH_DISABLED: 'true' });
      expect(await service.sendToUser('u1', { title: 't', body: 'b', data: { url: '/', kind: 'k' } })).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('envía los tokens de Firebase por FCM y borra los que ya no existen', async () => {
      global.fetch = jest.fn(async (url: any, init: any) => {
        if (String(url).includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'acceso', expires_in: 3600 }) };
        const to = JSON.parse(init.body).message.token;
        return to === FCM_TOKEN ? { ok: true, json: async () => ({}) } : { ok: false, status: 404, json: async () => ({ error: { status: 'NOT_FOUND' } }) };
      }) as any;
      const viejo = 'x' + FCM_TOKEN.slice(1);
      const { service, queries } = make({ tokens: [FCM_TOKEN, viejo] }, { FIREBASE_SERVICE_ACCOUNT_JSON: SA_JSON });
      expect(await service.sendToUser('u1', { title: 't', body: 'b', data: { url: '/', kind: 'k' } })).toBe(1);
      expect(queries.find((q) => q.sql.startsWith('DELETE FROM push_token WHERE token = ANY'))?.params).toEqual([[viejo]]);
    });

    it('rechaza tokens que no son de Expo y reasigna el teléfono a la última cuenta', async () => {
      const { service, queries } = make({});
      await expect(service.register('u1', 'cualquier cosa', 'android')).rejects.toThrow('Token de notificaciones no válido.');
      await service.register('u2', TOKEN, 'ios');
      const insert = queries.find((q) => q.sql.includes('INSERT INTO push_token'))!;
      expect(insert.sql).toContain('ON CONFLICT (token) DO UPDATE SET usuario_id');
      expect(insert.params).toEqual([TOKEN, 'u2', 'ios']);
    });
  });
});
