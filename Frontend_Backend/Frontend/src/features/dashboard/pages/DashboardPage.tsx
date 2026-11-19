import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { StatsOverview } from '../components/StatsOverview';
import { AnalysisServicesStatus } from '../components/AnalysisServicesStatus';
import { StorageOverview } from '../components/StorageOverview';
import { UserMetricsChart } from '../components/UserMetricsChart';
import { PlatformStatus } from '../components/PlatformStatus';
import { dashboardService } from '../services/dashboard.service';
import { useAuthStore } from '@/features/auth';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';

const DASHBOARD_QUERY_KEY = ['admin-dashboard'] as const;

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: dashboardService.getDashboardMetrics,
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <DashboardHeader userName={user?.name} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 rounded-2xl bg-muted/50 border border-border animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-muted/50 border border-border animate-pulse" />
        <div className="h-56 rounded-2xl bg-muted/50 border border-border animate-pulse" />
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          Cargando supervisión administrativa y estado de servicios...
        </p>
      </div>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    const status = getApiErrorStatus(dashboardQuery.error);
    const title =
      status === 403
        ? 'Acceso denegado'
        : status === 401
        ? 'Sesión expirada'
        : 'No se pudo cargar el dashboard';

    return (
      <div className="space-y-6">
        <DashboardHeader userName={user?.name} />
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="size-10 mx-auto text-destructive" />
          <div>
            <h2 className="font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {getApiErrorMessage(
                dashboardQuery.error,
                'No fue posible consultar el estado y métricas de la plataforma.',
              )}
            </p>
          </div>
          {status !== 401 && (
            <Button
              variant="outline"
              onClick={() => {
                void dashboardQuery.refetch();
              }}
            >
              <RefreshCw className="size-4 mr-2" />
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  const generatedAt = new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dashboardQuery.data.generatedAt));

  return (
    <div className="space-y-6">
      <DashboardHeader userName={user?.name} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
        <span>Datos actualizados: {generatedAt}</span>
        <Button
          variant="outline"
          disabled={dashboardQuery.isFetching}
          onClick={() => {
            void dashboardQuery.refetch();
          }}
        >
          <RefreshCw className={`size-4 mr-2 ${dashboardQuery.isFetching ? 'animate-spin' : ''}`} />
          Actualizar datos
        </Button>
      </div>

      {/* Criterios 1, 2 y 3: Resumen general en tarjetas */}
      <StatsOverview metrics={dashboardQuery.data} />

      {/* Criterio 2: Disponibilidad de servicios de análisis */}
      <AnalysisServicesStatus metrics={dashboardQuery.data} />

      {/* Criterio 3: Espacio utilizado por las fotografías almacenadas */}
      <StorageOverview metrics={dashboardQuery.data} />

      {/* Criterio 1: Cifras reales y distribución de usuarias por rol y estado */}
      <UserMetricsChart users={dashboardQuery.data.users} />

      {/* Estado y configuraciones de gobernanza */}
      <PlatformStatus metrics={dashboardQuery.data} />
    </div>
  );
}

function DashboardHeader({ userName }: { userName?: string }) {
  return (
    <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      <div className="relative z-10 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
          <Sparkles className="size-3.5" />
          Panel General
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          ¡Hola, {userName || 'Administrador'}!
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Supervisión en tiempo real del uso de la plataforma, estado de servicios de análisis y almacenamiento.
        </p>
      </div>
    </div>
  );
}
