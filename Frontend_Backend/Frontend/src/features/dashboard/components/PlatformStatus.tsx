import { Link } from 'react-router';
import { ClipboardList, Settings, UserPlus, Wrench } from 'lucide-react';
import type { DashboardMetrics } from '../types/dashboard.types';

function StatusItem({
  label,
  enabled,
  enabledLabel,
  disabledLabel,
  icon: Icon,
}: {
  label: string;
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span
        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
          enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
        }`}
      >
        {enabled ? enabledLabel : disabledLabel}
      </span>
    </div>
  );
}

export function PlatformStatus({ metrics }: { metrics: DashboardMetrics }) {
  const lastEvent = metrics.audit.lastEventAt
    ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(metrics.audit.lastEventAt),
      )
    : 'Sin eventos registrados';

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Estado de plataforma</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Valores de configuración persistidos al momento de la última consulta.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Settings className="size-3.5" />
            Configuración
          </Link>
          <Link
            to="/audit-logs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ClipboardList className="size-3.5" />
            Auditoría
          </Link>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <StatusItem
          label="Modo mantenimiento"
          enabled={metrics.platform.maintenanceMode}
          enabledLabel="Activo"
          disabledLabel="Inactivo"
          icon={Wrench}
        />
        <StatusItem
          label="Creación administrativa de usuarios"
          enabled={metrics.platform.userCreationEnabled}
          enabledLabel="Habilitada"
          disabledLabel="Deshabilitada"
          icon={UserPlus}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Último evento administrativo registrado:{' '}
        <span className="font-medium text-foreground">{lastEvent}</span>
      </p>
    </section>
  );
}
