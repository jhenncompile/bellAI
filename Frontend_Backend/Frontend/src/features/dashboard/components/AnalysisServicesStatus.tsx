import { AlertTriangle, Bot, Camera, CheckCircle2, Database, Layers, XCircle } from 'lucide-react';
import type { AnalysisServiceKey, DashboardMetrics, ServiceState } from '../types/dashboard.types';
import { servicesView, TONE_BADGE, TONE_CARD } from '../lib/dashboard-view';

const ICONS: Record<AnalysisServiceKey, React.ElementType> = {
  vision: Camera,
  analysisQueue: Layers,
  virtualAdvisor: Bot,
  recommendations: Database,
};

const STATE_ICON: Record<ServiceState, React.ElementType> = {
  available: CheckCircle2,
  degraded: AlertTriangle,
  unavailable: XCircle,
};

/** HU-30 Criterio 2: si cada servicio de análisis está disponible, comprobado al consultar el panel. */
export function AnalysisServicesStatus({ metrics }: { metrics: DashboardMetrics }) {
  const view = servicesView(metrics.analysisServices);

  if (!view) {
    return (
      <section className="bg-card border border-warning/40 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-foreground">Disponibilidad de servicios de análisis</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No se pudo comprobar el estado de los servicios. Pulsa «Actualizar datos» para intentarlo de nuevo.
        </p>
      </section>
    );
  }

  const checkedAt = metrics.analysisServices
    ? new Intl.DateTimeFormat('es-BO', { timeStyle: 'medium' }).format(new Date(metrics.analysisServices.lastCheckedAt))
    : null;
  const HeadlineIcon = view.tone === 'success' ? CheckCircle2 : view.tone === 'warning' ? AlertTriangle : XCircle;

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" aria-labelledby="servicios-titulo">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="servicios-titulo" className="text-base font-bold text-foreground">
              Disponibilidad de servicios de análisis
            </h3>
            <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 inline-flex items-center gap-1 ${TONE_BADGE[view.tone]}`}>
              <HeadlineIcon className="size-3" />
              {view.headline} ({view.available}/{view.total})
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cada servicio se comprueba al cargar el panel{checkedAt ? ` (última comprobación: ${checkedAt})` : ''}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {view.items.map(({ key, category, info, tone }) => {
          const Icon = ICONS[key];
          const StateIcon = STATE_ICON[info.status];
          return (
            <div key={key} className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${TONE_CARD[tone]}`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TONE_BADGE[tone]}`}>
                    <StateIcon className="size-3" />
                    {info.label}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${info.status === 'unavailable' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    <Icon className="size-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground leading-snug">{info.name}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{info.details}</p>
              </div>

              {(info.latencyMs !== undefined && info.latencyMs !== null) || info.provider ? (
                <dl className="pt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
                  {info.latencyMs !== undefined && info.latencyMs !== null && (
                    <div className="flex items-center justify-between gap-2">
                      <dt>Tiempo de respuesta</dt>
                      <dd className="font-medium text-foreground">{info.latencyMs} ms</dd>
                    </div>
                  )}
                  {info.provider && (
                    <div className="flex items-center justify-between gap-2">
                      <dt>Funciona con</dt>
                      <dd className="font-medium text-foreground text-right">{info.provider}</dd>
                    </div>
                  )}
                </dl>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
