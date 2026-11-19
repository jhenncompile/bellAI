/** API pública de la feature de autenticación. */
export { LoginPage } from './pages/LoginPage';
export { LoginForm } from './components/LoginForm';
export { ProtectedRoute } from './components/ProtectedRoute';
export { AdminRoute } from './components/AdminRoute';
export { useAuthStore } from './store/auth.store';
export { authService } from './services/auth.service';
export type { User, LoginCredentials, AuthResponse } from './types/auth.types';
