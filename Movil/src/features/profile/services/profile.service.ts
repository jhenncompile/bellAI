import { apiClient } from '@/shared/api/apiClient';
import {
  UserProfileResponse,
  UpdateProfileDto,
  ApiPreferences,
  UpdatePreferencesDto,
} from '../model/profile.types';

export const profileService = {
  /**
   * Obtiene el perfil del usuario autenticado (GET /api/profile)
   */
  async getProfile(): Promise<UserProfileResponse> {
    const response = await apiClient.get<UserProfileResponse>('/profile');
    return response.data;
  },

  /**
   * Actualiza los datos del perfil (PUT /api/profile)
   */
  async updateProfile(dto: UpdateProfileDto): Promise<UserProfileResponse> {
    const response = await apiClient.put<UserProfileResponse>('/profile', dto);
    return response.data;
  },

  /**
   * Obtiene las preferencias del usuario (GET /api/profile/preferences)
   */
  async getPreferences(): Promise<ApiPreferences> {
    const response = await apiClient.get<ApiPreferences>('/profile/preferences');
    return response.data;
  },

  /**
   * Actualiza las preferencias del usuario (PUT /api/profile/preferences)
   */
  async updatePreferences(dto: UpdatePreferencesDto): Promise<ApiPreferences> {
    const response = await apiClient.put<ApiPreferences>('/profile/preferences', dto);
    return response.data;
  },

  /**
   * Sube la fotografía de avatar a través de multipart (POST /api/upload/avatar)
   */
  async uploadAvatar(fileUri: string, mimeType = 'image/jpeg'): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'avatar.jpg';

    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    } as any);

    const response = await apiClient.post<{ avatarUrl: string }>('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};
