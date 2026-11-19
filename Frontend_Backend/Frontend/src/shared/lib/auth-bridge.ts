/**
 * Puente entre la capa `shared` y la feature de autenticación.
 *
 * `shared/` nunca debe importar de `features/`, pero el cliente Axios necesita
 * el token JWT y provocar el logout global ante un 401. La feature de auth se
 * registra aquí al arrancar la app (ver `app/setup/axios-auth.ts`).
 */
interface AuthBridgeHandlers {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

const handlers: AuthBridgeHandlers = {
  getToken: () => null,
  onUnauthorized: () => {},
};

export function registerAuthBridge(next: AuthBridgeHandlers) {
  handlers.getToken = next.getToken;
  handlers.onUnauthorized = next.onUnauthorized;
}

export const authBridge: AuthBridgeHandlers = {
  getToken: () => handlers.getToken(),
  onUnauthorized: () => handlers.onUnauthorized(),
};
