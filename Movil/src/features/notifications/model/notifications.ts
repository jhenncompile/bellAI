import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsApi } from '../api/notificationsApi';

/**
 * Notificaciones de BellAI (HU-12 y HU-20):
 * - «Outfit del día»: local, cada mañana a las 8:00. La genera el propio teléfono.
 * - «Análisis terminado»: push desde el servidor al acabar la tarea, para que llegue aunque la
 *   usuaria haya salido de la app. En Android va directo por Firebase (FCM). Si este teléfono no
 *   tiene push (Expo Go o compilación sin google-services.json), se muestra un aviso local
 *   cuando el análisis termina con la app en segundo plano.
 * - Interruptor en Perfil, guardado en `preferences.pushNotifications`.
 */

const CHANNEL_ID = 'avisos';
const DAILY_ID = 'outfit-del-dia';
const DAILY_HOUR = 8;
const PUSH_TOKEN_KEY = 'bellai.notificaciones.token';
const ENABLED_KEY = 'bellai.notificaciones.activadas';
const ASKED_KEY = 'bellai.notificaciones.preguntado';

/** Avisos de tareas: con la app abierta no hace falta el banner, la pantalla ya muestra el resultado. */
const TASK_KINDS = new Set(['analisis_listo', 'analisis_fallido', 'simulacion_lista', 'simulacion_fallida', 'avatar_listo', 'avatar_fallido']);

let configured = false;
let pushToken: string | null = null;

/** Comportamiento en primer plano y canal de Android. Se puede llamar varias veces. */
export async function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const kind = String(n.request.content.data?.kind ?? '');
      const showBanner = !(TASK_KINDS.has(kind) && AppState.currentState === 'active');
      return { shouldShowBanner: showBanner, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Avisos de BellAI',
      description: 'Tu outfit del día y cuando termina un análisis.',
      importance: AndroidImportance.HIGH,
    }).catch(() => {});
  }
  pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null);
}

async function hasPermission(ask: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Ruta de la app que abre la notificación al tocarla. */
export function urlOf(response: Notifications.NotificationResponse | null): string | null {
  const request = response?.notification.request;
  // Los mensajes que llegan directo de Firebase traen los datos en el trigger
  const url = request?.content.data?.url ?? (request?.trigger as any)?.remoteMessage?.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}

async function scheduleDailyOutfit() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: 'Tu outfit de hoy',
      body: 'Mira qué combinación te propone BellAI con tu armario y el clima de hoy.',
      data: { url: '/outfits', kind: 'outfit_del_dia' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: DAILY_HOUR, minute: 0, channelId: CHANNEL_ID },
  });
}

/** Proyecto de EAS, si lo hay: entonces se usa el servicio de Expo. */
function easProjectId(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Token push del teléfono. En Android, sin EAS, es el token nativo de Firebase (requiere el
 * google-services.json en la compilación); el backend envía entonces directo por FCM.
 * En Expo Go no hay push.
 */
async function pushTokenOfDevice(): Promise<string | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  const projectId = easProjectId();
  if (projectId) return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (Platform.OS !== 'android') return null;
  const device = await Notifications.getDevicePushTokenAsync();
  return typeof device.data === 'string' ? device.data : null;
}

async function registerPush() {
  try {
    const token = await pushTokenOfDevice();
    if (!token) return;
    await notificationsApi.register(token, Platform.OS === 'ios' ? 'ios' : 'android');
    pushToken = token;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token).catch(() => {});
  } catch (err) {
    // Sin Google/Apple configurados o sin conexión: queda el aviso local como respaldo
    console.warn('[notifications] No se pudo activar el push:', err);
  }
}

/** Quita el token del servidor (cerrar sesión o desactivar). */
export async function unregisterPush() {
  const token = pushToken ?? (await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null));
  pushToken = null;
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
  if (token) await notificationsApi.unregister(token).catch(() => {});
}

/** Lo que este teléfono tiene activado: la preferencia guardada y el permiso del sistema. */
export async function notificationsActive(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
  if (stored === 'false') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Activa o desactiva las notificaciones en este teléfono. Con `ask` pide el permiso si hace falta.
 * Devuelve si quedaron activas (false si la usuaria negó el permiso).
 */
export async function applyNotifications(enabled: boolean, opts: { ask?: boolean } = {}): Promise<boolean> {
  await configureNotifications();
  if (enabled && (await hasPermission(Boolean(opts.ask)))) {
    await AsyncStorage.setItem(ENABLED_KEY, 'true').catch(() => {});
    await scheduleDailyOutfit().catch((err) => console.warn('[notifications] No se pudo programar el outfit del día:', err));
    await registerPush();
    return true;
  }
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  if (!enabled) await unregisterPush();
  return false;
}

/**
 * Al iniciar sesión: aplica la preferencia de la cuenta. El permiso se pide una sola vez por
 * instalación; si la usuaria lo negó, se respeta y puede activarlo luego desde Perfil.
 */
export async function syncNotifications(accountEnabled: boolean) {
  await configureNotifications();
  const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
  if (accountEnabled && !asked) await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
  return applyNotifications(accountEnabled, { ask: accountEnabled && !asked });
}

/** Al cerrar sesión: el siguiente usuario del teléfono no hereda los avisos. */
export async function clearNotifications() {
  await unregisterPush();
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await AsyncStorage.removeItem(ENABLED_KEY).catch(() => {});
}

/**
 * Respaldo del push: si un análisis termina con la app en segundo plano y este teléfono no
 * recibe push, se avisa con una notificación local.
 */
export async function notifyIfAway(content: { title: string; body: string; url: string; kind: string }) {
  if (AppState.currentState === 'active' || pushToken) return;
  if (!(await notificationsActive())) return;
  await configureNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: { url: content.url, kind: content.kind } },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  }).catch(() => {});
}
