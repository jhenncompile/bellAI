import axios, { AxiosError } from 'axios';
import { ApiConfig } from './apiConfig';
import { notifyPlanLimit } from './planLimit';

// Comparte origen y puerto con el cliente del armario y el backend NestJS.
export const API_BASE_URL = ApiConfig.getBaseUrl();

let currentAuthToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/**
 * Error de la API ya traducido a lenguaje natural (`message`), conservando el código HTTP
 * y el mensaje original del servidor para que cada flujo decida qué mostrar.
 */
export class ApiRequestError extends Error {
  status?: number;
  serverMessage?: string;
  isNetworkError: boolean;

  constructor(
    message: string,
    options: { status?: number; serverMessage?: string; isNetworkError?: boolean } = {}
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.serverMessage = options.serverMessage;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

/**
 * HU-01: `AuthContext` registra aquí qué hacer cuando el servidor rechaza el token
 * (sesión expirada o cuenta desactivada): cerrar la sesión local.
 */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

/** Para clientes HTTP que no usan este axios (p. ej. el del armario con fetch): token rechazado. */
export const notifyUnauthorized = () => {
  unauthorizedHandler?.();
};

/** Lo llama `AuthContext` al iniciar sesión, restaurarla o cerrarla. */
export const setAuthToken = (token: string | null) => {
  currentAuthToken = token;
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export const setApiAuthToken = setAuthToken;

/** Token JWT de la sesión activa. Lo usan también los clientes basados en `fetch`. */
export const getAuthToken = (): string | null => currentAuthToken;

export const apiClient = axios.create({
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Interceptor de solicitud: URL base actual + Bearer token JWT si existe
apiClient.interceptors.request.use(
  (config) => {
    config.baseURL = ApiConfig.getBaseUrl();
    if (currentAuthToken && config.headers) {
      config.headers.Authorization = `Bearer ${currentAuthToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta: errores en lenguaje natural, sin códigos HTTP ni datos de infraestructura
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[]; statusCode?: number }>) => {
    let friendlyMessage = 'No pudimos completar la solicitud. Inténtalo de nuevo en unos segundos.';
    const status = error.response?.status;
    const rawServerMessage = error.response?.data?.message;
    const serverMessage = Array.isArray(rawServerMessage)
      ? rawServerMessage.join('. ')
      : rawServerMessage;
    const isNetworkError =
      error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response;

    // Token rechazado en una petición autenticada: la sesión ya no es válida
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (status === 401 && sentToken && unauthorizedHandler) {
      unauthorizedHandler();
    }
    // Tope del plan Gratis/Premium: el layout raíz ofrece la pantalla Premium
    if (status === 402) notifyPlanLimit(error.response?.data);

    if (isNetworkError) {
      friendlyMessage =
        'No pudimos conectar con el servidor. Comprueba tu conexión a internet y vuelve a intentarlo.';
    } else if (status === 429) {
      friendlyMessage = 'Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.';
    } else if (status === 401) {
      friendlyMessage = 'Credenciales no válidas o sesión expirada. Vuelve a iniciar sesión.';
    } else if (status === 403) {
      friendlyMessage = 'Tu cuenta no tiene permiso para realizar esta acción.';
    } else if (status && status >= 500) {
      friendlyMessage = 'El servidor tuvo un problema al procesar tu solicitud. Inténtalo de nuevo más tarde.';
    } else if (error.response?.data?.message) {
      // Mensajes de validación del backend (ya vienen redactados en español para la usuaria)
      const rawMsg = error.response.data.message;
      friendlyMessage = Array.isArray(rawMsg) ? rawMsg.join('. ') : rawMsg;
    } else if (status === 404) {
      friendlyMessage = 'No encontramos lo que buscabas.';
    } else if (status === 409) {
      friendlyMessage = 'Ya existe un registro con esos datos.';
    }

    return Promise.reject(
      new ApiRequestError(friendlyMessage, { status, serverMessage, isNetworkError })
    );
  }
);
