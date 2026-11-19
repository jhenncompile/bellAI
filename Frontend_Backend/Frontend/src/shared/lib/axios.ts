import axios from 'axios';
import { authBridge } from './auth-bridge';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Inyectar el Bearer Token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = authBridge.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Manejo global de sesión expirada (401)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authBridge.onUnauthorized();
    }
    return Promise.reject(error);
  }
);
