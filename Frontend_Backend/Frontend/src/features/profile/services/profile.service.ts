import { apiClient } from '@/shared/lib/axios';
import type {
  AvatarUploadResponse,
  UpdatePreferencesDTO,
  UpdateProfileDTO,
  UserProfileResponse,
} from '../types/profile.types';

export const profileService = {
  async getProfile(): Promise<UserProfileResponse> {
    const { data } = await apiClient.get<UserProfileResponse>('/profile');
    return data;
  },

  async updateProfile(dto: UpdateProfileDTO): Promise<UserProfileResponse> {
    const { data } = await apiClient.put<UserProfileResponse>('/profile', dto);
    return data;
  },

  async updatePreferences(dto: UpdatePreferencesDTO) {
    const { data } = await apiClient.put('/profile/preferences', dto);
    return data;
  },

  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<AvatarUploadResponse>('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};
