import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TasksService } from '../tasks/tasks.service';
import { chunk, deadTokens, expoPayload, isExpoPushToken, isPushToken, PushMessage, taskFinishedMessage } from './push.messages';
import { FcmClient, loadServiceAccount } from './fcm.client';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Notificaciones push (HU-005 / HU-016).
 * - Tokens nativos de Android: directo por Firebase (FCM v1) con la cuenta de servicio
 *   (FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON).
 * - Tokens de Expo (ExponentPushToken[…]): por el servicio de Expo.
 * - Cada teléfono registra su token al iniciar sesión, si la usuaria las tiene activadas.
 * - Cuando termina un análisis o una simulación, se avisa a sus teléfonos.
 * - Respeta `preferences.push_notifications`: si está en false no se envía nada.
 * - Lo que viaja a Expo (y de ahí a Google/Apple) es solo el título y el texto del aviso:
 *   sin fotos, nombre ni correo.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly accessToken: string | null;
  private readonly disabled: boolean;
  private readonly fcm: FcmClient | null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tasks: TasksService,
    config: ConfigService,
  ) {
    // Opcional: solo hace falta si el proyecto de Expo exige envíos autenticados
    this.accessToken = config.get<string>('EXPO_ACCESS_TOKEN')?.trim() || null;
    this.disabled = config.get<string>('PUSH_DISABLED') === 'true';
    let fcm: FcmClient | null = null;
    try {
      const sa = loadServiceAccount(config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'), config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH'));
      if (sa) fcm = new FcmClient(sa);
    } catch (err: any) {
      this.logger.error(`No se pudo leer la cuenta de servicio de Firebase: ${err?.message}`);
    }
    this.fcm = fcm;
    if (fcm) this.logger.log(`Notificaciones push por Firebase (proyecto ${fcm.projectId}).`);
  }

  onModuleInit() {
    this.tasks.onFinished(async (e) => {
      const input = e.type === 'simulacion'
        ? (await this.dataSource.query('SELECT entrada FROM tarea WHERE id = $1', [e.taskId]))?.[0]?.entrada
        : undefined;
      const message = taskFinishedMessage(e.type, e.status, e.result, e.error, input);
      if (message) await this.sendToUser(e.userId, { ...message, data: { ...message.data, taskId: e.taskId } });
    });
  }

  async register(userId: string, token: unknown, platform: unknown) {
    if (!isPushToken(token)) throw new BadRequestException('Token de notificaciones no válido.');
    const plataforma = platform === 'ios' ? 'ios' : 'android';
    // El teléfono pasa a la última cuenta que lo registra
    await this.dataSource.query(
      `INSERT INTO push_token (token, usuario_id, plataforma) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, plataforma = EXCLUDED.plataforma, actualizado_en = CURRENT_TIMESTAMP`,
      [token, userId, plataforma],
    );
    return { registered: true };
  }

  async unregister(userId: string, token: unknown) {
    if (typeof token !== 'string' || !token) throw new BadRequestException('Falta el token.');
    await this.dataSource.query('DELETE FROM push_token WHERE token = $1 AND usuario_id = $2', [token, userId]);
    return { registered: false };
  }

  /** Sin fila de preferencias vale el valor por defecto de la tabla (activadas). */
  private async wantsPush(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query('SELECT push_notifications FROM preferences WHERE user_id = $1', [userId]);
    return rows?.[0]?.push_notifications !== false;
  }

  /** Envía un aviso a todos los teléfonos de la usuaria. Devuelve a cuántos se envió. */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    if (this.disabled || !(await this.wantsPush(userId))) return 0;
    const rows: { token: string }[] = await this.dataSource.query('SELECT token FROM push_token WHERE usuario_id = $1', [userId]);
    const all = rows.map((r) => r.token);
    if (!all.length) return 0;
    const expo = all.filter((t) => isExpoPushToken(t));
    const native = all.filter((t) => !isExpoPushToken(t));
    return (await this.sendFcm(native, message)) + (await this.sendExpo(expo, message));
  }

  private async sendFcm(tokens: string[], message: PushMessage): Promise<number> {
    if (!tokens.length) return 0;
    if (!this.fcm) {
      this.logger.warn('Hay teléfonos con token de Firebase pero falta FIREBASE_SERVICE_ACCOUNT_PATH: no se envía.');
      return 0;
    }
    const results = await Promise.all(tokens.map((t) => this.fcm!.send(t, message).catch((err) => ({ ok: false, dead: false, error: err?.message }))));
    const dead = tokens.filter((_, i) => results[i].dead);
    if (dead.length) await this.dataSource.query('DELETE FROM push_token WHERE token = ANY($1)', [dead]);
    results.filter((r) => !r.ok && !r.dead).forEach((r) => this.logger.warn(`Firebase rechazó un envío: ${r.error}`));
    return results.filter((r) => r.ok).length;
  }

  private async sendExpo(tokens: string[], message: PushMessage): Promise<number> {
    if (!tokens.length) return 0;
    let sent = 0;
    for (const batch of chunk(tokens)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(expoPayload(batch, message)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Expo rechazó el envío (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const tickets: any[] = ((await res.json()) as any)?.data ?? [];
      const dead = deadTokens(batch, tickets);
      if (dead.length) await this.dataSource.query('DELETE FROM push_token WHERE token = ANY($1)', [dead]);
      sent += batch.length - tickets.filter((t) => t?.status === 'error').length;
    }
    return sent;
  }
}
