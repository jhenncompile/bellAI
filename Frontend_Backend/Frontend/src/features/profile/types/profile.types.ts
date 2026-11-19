export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  profile: {
    id: string;
    bio: string;
    avatarUrl: string;
    phone: string;
    phoneMasked: string;
    address: string;
    birthDate: string;
  };
  preferences: UserPreferences;
}

export interface UserPreferences {
  id: string;
  theme: ThemePreference;
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingConsent: boolean;
  trackingConsent: boolean;
  stylePreferences: StylePreferences;
}

export interface StylePreferences {
  goals?: string[];
  preferredStyles?: string[];
  dislikedStyles?: string[];
  occasions?: string[];
  preferredColors?: string[];
  avoidedColors?: string[];
  budgetPerGarment?: number | null;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UpdateProfileDTO {
  name?: string;
  email?: string;
  bio?: string;
  phone?: string;
  avatarUrl?: string;
  birthDate?: string;
  address?: string;
}

export interface UpdatePreferencesDTO {
  theme?: ThemePreference;
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  marketingConsent?: boolean;
  trackingConsent?: boolean;
  stylePreferences?: StylePreferences;
}

export interface AvatarUploadResponse {
  url: string;
  size: number;
}

/** Valores editables del formulario de perfil. */
export interface ProfileFormValues {
  name: string;
  bio: string;
  phone: string;
  address: string;
  birthDate: string;
  avatarUrl: string;
}

/** Valores editables del formulario de preferencias. */
export interface PreferencesFormValues {
  theme: ThemePreference;
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingConsent: boolean;
  trackingConsent: boolean;
}
