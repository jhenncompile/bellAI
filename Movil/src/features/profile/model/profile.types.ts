/**
 * Modelos de datos para el dominio de Perfil y Preferencias
 */

export interface ApiPreferences {
  id?: string;
  userId?: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingConsent?: boolean;
  trackingConsent?: boolean;
}

export interface ApiUserProfileDetails {
  id: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  phoneMasked: string;
  address: string;
  birthDate: string;
}

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: string;
  profile: ApiUserProfileDetails;
  preferences: ApiPreferences;
}

export interface UpdateProfileDto {
  name?: string;
  bio?: string;
  phone?: string;
  avatarUrl?: string;
  birthDate?: string;
  address?: string;
}

export interface UpdatePreferencesDto {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  marketingConsent?: boolean;
  trackingConsent?: boolean;
}
