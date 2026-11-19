/**
 * Modelos de datos para el dominio de Autenticación
 */

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
}

export interface LoginDto {
  email: string;
  password?: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password?: string;
}

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
