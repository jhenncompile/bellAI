import { apiClient } from '@/shared/api/apiClient';
import { AuthResponse, LoginDto, RegisterDto, ApiUser } from '../model/auth.types';

export const authService = {
  /**
   * Inicia sesión en la API (POST /api/auth/login)
   */
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', {
      email: credentials.email.toLowerCase().trim(),
      password: credentials.password,
    });
    return response.data;
  },

  /**
   * Registra un nuevo usuario en la API (POST /api/auth/register)
   */
  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      // El rol no se envía: el backend crea siempre cuentas de usuaria en el registro público
    });
    return response.data;
  },

  /**
   * Obtiene la información del usuario autenticado (GET /api/auth/me)
   */
  async getMe(): Promise<ApiUser> {
    const response = await apiClient.get<ApiUser>('/auth/me');
    return response.data;
  },
};
