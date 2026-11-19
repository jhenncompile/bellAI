import axios from 'axios';
import { apiClient } from '@/shared/lib/axios';
import type { LoginCredentials, AuthResponse, User } from '../types/auth.types';

const MENSAJE_CREDENCIALES = 'Error al iniciar sesión. Verifica tu correo y contraseña.';
const MENSAJE_SIN_BACKEND =
  'No se puede conectar al servidor Backend (puerto 8000). Asegúrate de que esté iniciado.';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error: unknown) {
      throw new Error(obtenerMensajeDeError(error), { cause: error });
    }
  },

  async logout(): Promise<void> {
    // El backend no expone endpoint de logout: la sesión se limpia en el cliente
    // vaciando el store de auth (ver useAuthStore.logout).
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

function obtenerMensajeDeError(error: unknown): string {
  if (!axios.isAxiosError(error)) return MENSAJE_CREDENCIALES;

  const mensajeApi = (error.response?.data as { message?: string } | undefined)?.message;
  if (mensajeApi) return mensajeApi;

  return error.code === 'ERR_NETWORK' ? MENSAJE_SIN_BACKEND : MENSAJE_CREDENCIALES;
}
