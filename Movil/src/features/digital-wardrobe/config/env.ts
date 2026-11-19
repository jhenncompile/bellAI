import { Platform } from 'react-native';
import { ApiConfig, normalizeApiUrl } from '@/shared/api/apiConfig';

function detectDefaultOrigin(): string {
  if (ApiConfig.isRemoteConfigured()) {
    return ApiConfig.getOrigin();
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return ApiConfig.getOrigin();
}

function resolveInitialOrigin(): string {
  // Permite apuntar el armario a otro backend específico o usar el backend principal de ApiConfig
  const fromEnv = process.env.EXPO_PUBLIC_WARDROBE_API_URL;
  if (fromEnv && fromEnv.trim()) {
    return normalizeApiUrl(fromEnv) ?? detectDefaultOrigin();
  }
  return detectDefaultOrigin();
}

let currentBackendOrigin = resolveInitialOrigin();

export const EnvConfig = {
  getBackendOrigin(): string {
    return currentBackendOrigin.replace(/\/+$/, '');
  },

  getApiBaseUrl(): string {
    return `${this.getBackendOrigin()}/api`;
  },

  setBackendOrigin(newOrigin: string): void {
    const cleaned = normalizeApiUrl(newOrigin);
    if (cleaned) {
      currentBackendOrigin = cleaned;
    }
  },

  /**
   * Resuelve una URL relativa de imagen del backend (ej. `/uploads/wardrobe/enhanced_xxx.webp`)
   * a una URL absoluta consumible por el componente `<Image>` de React Native.
   */
  resolveImageUrl(relativeOrAbsoluteUrl?: string | null): string | null {
    if (!relativeOrAbsoluteUrl) return null;
    if (
      relativeOrAbsoluteUrl.startsWith('http://') ||
      relativeOrAbsoluteUrl.startsWith('https://') ||
      relativeOrAbsoluteUrl.startsWith('file://') ||
      relativeOrAbsoluteUrl.startsWith('blob:') ||
      relativeOrAbsoluteUrl.startsWith('data:')
    ) {
      return relativeOrAbsoluteUrl;
    }
    const normalizedPath = relativeOrAbsoluteUrl.startsWith('/')
      ? relativeOrAbsoluteUrl
      : `/${relativeOrAbsoluteUrl}`;
    return `${this.getBackendOrigin()}${normalizedPath}`;
  },
};
