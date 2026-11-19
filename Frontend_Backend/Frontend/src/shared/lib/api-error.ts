import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  if (!error.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.';
  }

  switch (error.response.status) {
    case 400: {
      // El backend devuelve mensajes en español listos para mostrar (p. ej. «Formato de modelo no válido»)
      const msg = error.response.data?.message;
      if (typeof msg === 'string' && msg.trim()) return msg;
      if (Array.isArray(msg) && msg.length) return msg.join('. ');
      return 'Los datos enviados no son válidos.';
    }
    case 401:
      return 'La sesión no es válida o las credenciales son incorrectas.';
    case 403:
      return 'No tienes permisos para realizar esta operación.';
    case 404:
      return 'El recurso solicitado no fue encontrado.';
    case 409:
      if (error.response.data?.code === 'USER_CREATION_DISABLED') {
        return 'La creación de usuarios está deshabilitada temporalmente por la configuración de la plataforma.';
      }
      return error.response.data?.message || 'La operación entra en conflicto con información existente.';
    default:
      return error.response.data?.message || fallback;
  }
}

export function getApiErrorStatus(error: unknown): number | null {
  return axios.isAxiosError(error) && error.response ? error.response.status : null;
}
