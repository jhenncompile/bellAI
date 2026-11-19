import { getAuthToken, notifyUnauthorized } from '@/shared/api/apiClient';
import { getUserSession } from '@/entities/user/model/storage';
import { EnvConfig } from '../config/env';
import { offlineSyncStorage } from '../storage/offlineSyncStorage';
import { sendFormData } from '@/shared/api/xhrUpload';
import { notifyPlanLimit } from '@/shared/api/planLimit';

export class ApiError extends Error {
  statusCode?: number;
  isNetworkError: boolean;
  rawData?: unknown;

  constructor(
    message: string,
    options?: { statusCode?: number; isNetworkError?: boolean; rawData?: unknown },
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
    this.isNetworkError = Boolean(options?.isNetworkError);
    this.rawData = options?.rawData;
  }
}

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Cliente HTTP Singleton equivalente al `ApiProvider` + `AuthInterceptor` original,
 * migrado a React Native + TypeScript con soporte nativo para `FormData` (cámara/galería)
 * e inyección automática de `Bearer <JWT>`.
 */
class ApiClient {
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const base = EnvConfig.getApiBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    // Mismo JWT que inyecta AuthContext en el cliente axios compartido
    let token = getAuthToken();
    if (!token) {
      try {
        const session = await getUserSession();
        token = session?.token || null;
      } catch {
        // No se pudo leer la sesión local
      }
    }
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    };

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // FormData con fotos: XMLHttpRequest (el fetch de Expo SDK 58 no admite partes { uri })
      const response = isFormData && method !== 'GET' && method !== 'DELETE'
        ? await sendFormData(method, this.buildUrl(path, options?.params), body as FormData, headers, timeoutMs).then((r) => ({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            text: async () => r.text,
          }))
        : await fetch(this.buildUrl(path, options?.params), {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : isFormData
              ? (body as FormData)
              : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let parsed: any = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!response.ok) {
        // Token rechazado: la sesión caducó; AuthContext vuelve al inicio de sesión
        if (response.status === 401 && token) notifyUnauthorized();
        if (response.status === 402) notifyPlanLimit(parsed);
        const backendMessage =
          Array.isArray(parsed?.message)
            ? parsed.message.join('. ')
            : response.status === 401
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : parsed?.message || 'El servidor no pudo completar la solicitud. Inténtalo de nuevo.';

        throw new ApiError(String(backendMessage), {
          statusCode: response.status,
          isNetworkError: false,
          rawData: parsed,
        });
      }

      return parsed as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error?.name === 'AbortError') {
        throw new ApiError(
          'Tiempo de espera agotado al conectar con el servidor. Verifica tu conexión.',
          { isNetworkError: true },
        );
      }

      throw new ApiError(
        'No se pudo conectar con el servidor. Estás viendo el respaldo disponible sin conexión.',
        { isNetworkError: true },
      );
    }
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const api = new ApiClient();
