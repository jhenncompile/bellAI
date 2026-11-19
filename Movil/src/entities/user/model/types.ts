export type AuraGoal =
  | 'Vestirme mejor'
  | 'Encontrar mi estilo'
  | 'Cambiar mi imagen'
  | 'Vestirme para ocasiones'
  | 'Aprovechar mi armario';

export type AestheticStyle =
  | 'Old Money Chic'
  | 'Clean Girl Aesthetic'
  | 'Minimalista Sofisticado'
  | 'Dark Academia'
  | 'Romántico Clásico'
  | 'Streetwear / Urbano'
  | 'Quiet Luxury'
  | 'Y2K Glam';

export type UsualOccasion =
  | 'Trabajo / Oficina'
  | 'Casual Diario'
  | 'Eventos Formales'
  | 'Salidas Nocturnas'
  | 'Citas / Eventos Sociales';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUri?: string;
  avatar?: string;
  role?: 'admin' | 'manager' | 'user';
  status?: string;
  token?: string;
  createdAt: string;
}

export interface UserSession {
  user: UserAccount | null;
  isAuthenticated: boolean;
  token?: string;
  lastLoginAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  goals: AuraGoal[];
  preferredStyles: AestheticStyle[];
  dislikedStyles: AestheticStyle[];
  occasions: UsualOccasion[];
  isOnboarded: boolean;
  createdAt: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr_guest',
  name: '',
  goals: ['Vestirme mejor', 'Encontrar mi estilo'],
  preferredStyles: ['Old Money Chic', 'Quiet Luxury'],
  dislikedStyles: ['Y2K Glam'],
  occasions: ['Trabajo / Oficina', 'Casual Diario'],
  isOnboarded: false,
  createdAt: new Date().toISOString(),
};
