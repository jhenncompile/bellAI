import { apiClient } from '@/shared/lib/axios';
import type { PlatformSetting, SettingKey, SettingsResponse, SettingResponse, SettingValue } from '../types/settings.types';
import { isSettingKey } from '../types/settings.types';

export const settingsService = {
  async getSettings(): Promise<PlatformSetting[]> {
    const response = await apiClient.get<SettingsResponse>('/admin/settings');
    return response.data.settings;
  },

  async updateSetting(key: SettingKey, value: SettingValue): Promise<PlatformSetting> {
    if (!isSettingKey(key) || !['boolean', 'number', 'string'].includes(typeof value)) {
      throw new TypeError('Clave o valor de configuración inválido');
    }
    const response = await apiClient.patch<SettingResponse>(`/admin/settings/${key}`, { value });
    return response.data.setting;
  },
};
