import { registerAuthBridge } from '@/shared/lib/auth-bridge';
import { useAuthStore } from '@/features/auth';

/**
 * Conecta el cliente Axios compartido con el store de autenticación.
 * Se ejecuta al importarse el módulo, antes del primer render y por tanto
 * antes de cualquier petición HTTP.
 */
registerAuthBridge({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().logout(),
});
