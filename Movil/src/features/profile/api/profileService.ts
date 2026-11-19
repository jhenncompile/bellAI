import { Platform } from 'react-native';
import { apiClient } from '@/shared/api/apiClient';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';

export interface StylePreferences {
  goals?: string[];
  preferredStyles?: string[];
  dislikedStyles?: string[];
  occasions?: string[];
  preferredColors?: string[];
  avoidedColors?: string[];
  budgetPerGarment?: number | null;
}

export interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  profile: {
    id: string;
    bio: string;
    avatarUrl: string;
    phone: string;
    address: string;
    birthDate: string;
  };
  preferences: {
    stylePreferences: StylePreferences;
  };
}

export interface UpdateProfileInput {
  name: string;
  email: string;
  bio?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
}

export interface ProfileFormValues extends UpdateProfileInput {
  avatarUrl: string;
  phone: string;
  bio: string;
  address: string;
  birthDate: string;
  stylePreferences: StylePreferences;
}

function resolveAvatarUrl(url?: string | null): string {
  const resolved = EnvConfig.resolveImageUrl(url);
  if (!resolved) return '';
  try {
    const parsed = new URL(resolved);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
      return `${EnvConfig.getBackendOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return resolved;
  }
  return resolved;
}

export const profileService = {
  async getProfile(): Promise<ProfileResponse> {
    const { data } = await apiClient.get<ProfileResponse>('/profile');
    data.profile.avatarUrl = resolveAvatarUrl(data.profile.avatarUrl);
    return data;
  },

  async updateProfile(input: UpdateProfileInput): Promise<ProfileResponse> {
    const { data } = await apiClient.put<ProfileResponse>('/profile', input);
    return data;
  },

  async uploadAvatar(uri: string, fileName: string, mimeType: string): Promise<string> {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('No se pudo leer la fotografía seleccionada.');
      formData.append('file', await response.blob(), fileName);
    } else {
      formData.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
    }

    const { data } = await apiClient.post<{ avatarUrl: string }>('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return resolveAvatarUrl(data.avatarUrl);
  },

  async updatePreferences(stylePreferences: StylePreferences): Promise<void> {
    await apiClient.put('/profile/preferences', { stylePreferences });
  },
};
