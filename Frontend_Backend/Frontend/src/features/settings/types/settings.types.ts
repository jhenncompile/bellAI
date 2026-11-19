export type SettingKey = string;
export type SettingValue = boolean | number | string;
export type SettingGroup = 'plataforma' | 'fotografias' | 'ia';

/** Configuración tipada que expone GET /api/admin/settings (HU-030). */
export interface PlatformSetting {
  key: SettingKey;
  value: SettingValue;
  defaultValue: SettingValue;
  type: 'boolean' | 'number' | 'string';
  group: SettingGroup;
  label: string;
  description: string;
  min?: number;
  max?: number;
  /** Valores permitidos (p. ej. el proveedor del asistente): se muestra un selector */
  options?: string[];
  updatedAt: string;
}

export interface SettingsResponse {
  settings: PlatformSetting[];
}

export interface SettingResponse {
  setting: PlatformSetting;
}

export const SETTING_GROUPS: { id: SettingGroup; title: string; description: string }[] = [
  { id: 'plataforma', title: 'Plataforma', description: 'Acceso, registro y límites generales.' },
  { id: 'fotografias', title: 'Validación de fotografías', description: 'Umbrales que debe cumplir una foto antes de analizarse (HU-035).' },
  { id: 'ia', title: 'Inteligencia artificial', description: 'Cola de análisis y asistente conversacional local.' },
];

export function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === 'string' && /^[a-z0-9_]{2,64}$/.test(value);
}
