import { apiClient } from '@/shared/api/apiClient';

/** Registro del token push del teléfono en el backend (POST/DELETE /api/notifications/push-token). */
export const notificationsApi = {
  register: async (token: string, platform: 'android' | 'ios') =>
    (await apiClient.post<{ registered: boolean }>('/notifications/push-token', { token, platform })).data,
  unregister: async (token: string) =>
    (await apiClient.delete<{ registered: boolean }>('/notifications/push-token', { data: { token } })).data,
};
