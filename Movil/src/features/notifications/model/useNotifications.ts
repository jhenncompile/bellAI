import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { profileService } from '@/features/profile/services/profile.service';
import { syncNotifications, urlOf } from './notifications';

/**
 * Con la sesión iniciada: aplica en este teléfono la preferencia de notificaciones de la cuenta
 * y, al tocar una notificación, abre su pantalla (también si la app estaba cerrada).
 */
export function useNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      try {
        const prefs = await profileService.getPreferences();
        await syncNotifications(prefs.pushNotifications !== false);
      } catch (err) {
        // Sin conexión: se mantiene lo que ya estaba programado en el teléfono
        console.warn('[notifications] No se pudo sincronizar la preferencia:', err);
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = urlOf(response);
      if (!url) return;
      // Espera a que el Stack esté montado antes de navegar
      setTimeout(() => router.push(url as any), 0);
    };
    // App abierta desde una notificación estando cerrada
    open(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [isAuthenticated]);
}
