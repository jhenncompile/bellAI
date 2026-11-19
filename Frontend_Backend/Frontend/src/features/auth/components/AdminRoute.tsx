import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, ShieldX } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { getAdminAccessDecision } from '../utils/admin-access';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const [isHydrated, setIsHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(
    () => useAuthStore.persist.onFinishHydration(() => setIsHydrated(true)),
    [],
  );

  const canValidate = isHydrated && isAuthenticated && Boolean(token);
  const sessionQuery = useQuery({
    queryKey: ['admin-session', token],
    queryFn: authService.getProfile,
    enabled: canValidate,
    retry: false,
    staleTime: 0,
  });

  const decision = getAdminAccessDecision({
    isHydrated,
    isAuthenticated,
    hasToken: Boolean(token),
    isValidating: canValidate && (sessionQuery.isPending || sessionQuery.isFetching),
    validatedUser: sessionQuery.data,
    validationErrorStatus: getApiErrorStatus(sessionQuery.error),
    validationFailed: sessionQuery.isError,
  });

  if (decision === 'loading') {
    return (
      <div className="min-h-64 flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center text-muted-foreground">
          <Loader2 className="size-8 mx-auto mb-3 animate-spin text-primary" />
          <p className="text-sm">Verificando autorización administrativa...</p>
        </div>
      </div>
    );
  }

  if (decision === 'login') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (decision === 'denied') {
    return (
      <div className="min-h-64 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 text-center space-y-4">
          <ShieldX className="size-10 mx-auto text-destructive" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Acceso administrativo denegado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sessionQuery.error
                ? getApiErrorMessage(
                    sessionQuery.error,
                    'No fue posible verificar tus permisos administrativos.',
                  )
                : 'Tu cuenta no tiene permisos para consultar esta sección.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {sessionQuery.error && getApiErrorStatus(sessionQuery.error) !== 401 && (
              <Button variant="outline" onClick={() => void sessionQuery.refetch()}>
                <RefreshCw className="size-4 mr-2" />
                Reintentar verificación
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/profile', { replace: true })}>
              Ir a mi perfil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
