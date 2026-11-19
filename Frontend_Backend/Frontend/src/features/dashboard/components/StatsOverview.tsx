import { Users, UserCheck, HardDrive, Sparkles, ClipboardList } from 'lucide-react';
import type { DashboardMetrics } from '../types/dashboard.types';
import { servicesView, TONE_BADGE, usersView, type Tone } from '../lib/dashboard-view';

interface OverviewCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  badge?: { text: string; tone: Tone | 'default' };
}

function OverviewCard({ title, value, description, icon: Icon, badge }: OverviewCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {badge && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  badge.tone === 'default' ? 'bg-muted text-muted-foreground' : TONE_BADGE[badge.tone]
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** HU-30: resumen con cifras reales; si un dato no llegó del servidor se dice, no se inventa. */
export function StatsOverview({ metrics }: { metrics: DashboardMetrics }) {
  const u = usersView(metrics.users);
  const services = servicesView(metrics.analysisServices);
  const storage = metrics.storage;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {/* Criterio 1: usuarias registradas */}
      <OverviewCard
        title="Usuarias registradas"
        value={u.registered}
        description={`${metrics.users.total} cuentas en total, con administración`}
        icon={Users}
        badge={u.newThisWeek ? { text: `+${u.newThisWeek} esta semana`, tone: 'default' } : undefined}
      />

      {/* Criterio 1: usuarias activas (con actividad real en los últimos 30 días) */}
      <OverviewCard
        title="Usuarias activas"
        value={u.active30 ?? 'Sin datos'}
        description={
          u.active30 === null
            ? 'El servidor aún no registra la actividad.'
            : `Usaron la app en los últimos 30 días · ${u.active7} en 7 días`
        }
        icon={UserCheck}
        badge={u.enabled !== null ? { text: `${u.enabled} cuentas habilitadas`, tone: 'default' } : undefined}
      />

      {/* Criterio 2: servicios de análisis */}
      <OverviewCard
        title="Servicios de análisis"
        value={services ? `${services.available}/${services.total}` : 'Sin datos'}
        description={services ? services.headline : 'No se pudo comprobar el estado de los servicios.'}
        icon={Sparkles}
        badge={services ? { text: services.tone === 'success' ? 'Disponibles' : 'Revisar', tone: services.tone } : undefined}
      />

      {/* Criterio 3: espacio de las fotografías */}
      <OverviewCard
        title="Espacio de fotografías"
        value={storage ? storage.photosStorageFormatted : 'Sin datos'}
        description={storage ? `${storage.photosCount} fotografías almacenadas` : 'No se pudo medir el almacenamiento.'}
        icon={HardDrive}
        badge={storage?.usagePercent !== null && storage?.usagePercent !== undefined
          ? { text: `${storage.usagePercent} % de la cuota`, tone: storage.usagePercent >= 90 ? 'destructive' : storage.usagePercent >= 75 ? 'warning' : 'default' }
          : undefined}
      />

      <OverviewCard
        title="Eventos de auditoría"
        value={metrics.audit.totalEvents}
        description={`${metrics.audit.eventsLast7Days} eventos en 7 días`}
        icon={ClipboardList}
      />
    </div>
  );
}
