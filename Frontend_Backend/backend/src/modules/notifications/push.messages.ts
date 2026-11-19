/**
 * Textos de las notificaciones push y formato del servicio de Expo. Funciones puras, sin red.
 * `data.url` es la ruta de la app (expo-router) que se abre al tocar la notificación.
 */

export interface PushMessage {
  title: string;
  body: string;
  data: { url: string; kind: string; [key: string]: unknown };
}

/** Tipos de tarea (los mismos que registran diagnosis y simulations). */
const DIAGNOSIS = 'diagnostico';
const SIMULATION = 'simulacion';
const AVATAR_SCAN = 'avatar_escaneo';

const SIMULATION_TEXT: Record<string, string> = {
  corte_cabello: 'tu nuevo corte',
  color_cabello: 'tu nuevo color de cabello',
  maquillaje: 'tu maquillaje',
  unas: 'tus uñas',
  gafas: 'las gafas',
  prenda: 'la prenda',
};

/** Aviso de fin de tarea; null para los tipos que no merecen notificación. */
export function taskFinishedMessage(
  type: string,
  status: 'completada' | 'fallida',
  result: any,
  error: string | null,
  input?: any,
): PushMessage | null {
  if (type === DIAGNOSIS) {
    if (status === 'fallida') {
      return {
        title: 'No pudimos terminar tu análisis',
        body: error || 'Vuelve a intentarlo con otra foto.',
        data: { url: '/studio', kind: 'analisis_fallido' },
      };
    }
    const season = typeof result?.season === 'string' && result.season.trim() ? result.season.trim() : null;
    return {
      title: 'Tu diagnóstico está listo',
      body: season ? `Eres ${season}. Mira tu paleta y lo que mejor te queda.` : 'Mira tu paleta y lo que mejor te queda.',
      data: { url: '/studio', kind: 'analisis_listo' },
    };
  }
  if (type === SIMULATION) {
    const what = SIMULATION_TEXT[String(input?.kind ?? result?.kind ?? '')] ?? 'tu simulación';
    return status === 'fallida'
      ? { title: 'No pudimos terminar la simulación', body: error || 'Vuelve a intentarlo.', data: { url: '/simulator', kind: 'simulacion_fallida' } }
      : { title: 'Tu simulación está lista', body: `Ya puedes ver cómo te queda ${what}.`, data: { url: '/simulator', kind: 'simulacion_lista' } };
  }
  if (type === AVATAR_SCAN) {
    return status === 'fallida'
      ? { title: 'No pudimos armar tu avatar', body: error || 'Repite el escaneo con buena luz.', data: { url: '/avatar', kind: 'avatar_fallido' } }
      : { title: 'Tu avatar 3D está listo', body: 'Lo armamos con tus medidas. Míralo y vístelo con tus outfits.', data: { url: '/avatar', kind: 'avatar_listo' } };
  }
  return null;
}

/** Tokens que entrega `getExpoPushTokenAsync`: ExponentPushToken[…] o ExpoPushToken[…]. */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length <= 255 && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

/** Token nativo de Firebase (getDevicePushTokenAsync en Android): texto largo sin espacios. */
export function isFcmToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 100 && token.length <= 255 && /^[A-Za-z0-9_:-]+$/.test(token);
}

export function isPushToken(token: unknown): token is string {
  return isExpoPushToken(token) || isFcmToken(token);
}

/** Mensajes para POST https://exp.host/--/api/v2/push/send (como mucho 100 por petición). */
export function expoPayload(tokens: string[], m: PushMessage) {
  return tokens.map((to) => ({ to, title: m.title, body: m.body, data: m.data, sound: 'default', channelId: 'avisos', priority: 'high' }));
}

export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Tokens que ya no sirven: el teléfono desinstaló la app o revocó el permiso.
 * Los recibos vienen en el mismo orden que los mensajes enviados.
 */
export function deadTokens(sent: string[], tickets: any[]): string[] {
  return sent.filter((_, i) => tickets?.[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered');
}
