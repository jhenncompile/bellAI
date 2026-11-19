import { Image as ImageIcon, ScanFace, Shirt, User } from 'lucide-react';
import type { DashboardMetrics } from '../types/dashboard.types';
import { SEGMENT_BAR, storageView, TONE_BAR } from '../lib/dashboard-view';

const SEGMENT_ICON = {
  wardrobePhotos: Shirt,
  analysisPhotos: ScanFace,
  avatarPhotos: User,
  otherMedia: ImageIcon,
} as const;

const SEGMENT_HINT = {
  wardrobePhotos: (n: number) => `${n} fotos de prendas`,
  analysisPhotos: (n: number) => `${n} fotos de rostro y cuerpo de los análisis`,
  avatarPhotos: (n: number) => `${n} fotos de perfil`,
  otherMedia: (n: number) => `${n} imágenes de otros recursos`,
} as const;

/** HU-30 Criterio 3: espacio que ocupan las fotografías, por tipo, y uso frente a la cuota. */
export function StorageOverview({ metrics }: { metrics: DashboardMetrics }) {
  const storage = metrics.storage;
  const view = storageView(storage);

  if (!storage || !view) {
    return (
      <section className="bg-card border border-warning/40 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-foreground">Espacio utilizado por fotografías almacenadas</h3>
        <p className="text-sm text-muted-foreground mt-1">No se pudo medir el almacenamiento en este momento.</p>
      </section>
    );
  }

  const measuredAt = new Intl.DateTimeFormat('es-BO', { timeStyle: 'short' }).format(new Date(storage.measuredAt));

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" aria-labelledby="fotos-titulo">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="fotos-titulo" className="text-base font-bold text-foreground">
              Espacio utilizado por fotografías almacenadas
            </h3>
            <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20">
              {storage.photosStorageFormatted}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {storage.photosCount} fotografías · medido a las {measuredAt}. El almacenamiento total (con modelos y otros archivos) es {storage.totalStorageFormatted}.
          </p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1 rounded-lg border border-border self-start">
          {storage.storageDriver}
        </span>
      </div>

      {/* Reparto de las fotos por tipo */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Reparto por tipo</div>
        <div
          className="h-3 w-full bg-muted rounded-full overflow-hidden flex"
          role="img"
          aria-label={view.segments.map((s) => `${s.label}: ${s.formatted}`).join(', ')}
        >
          {view.segments.map((s, i) =>
            s.bytes > 0 ? (
              <div
                key={s.key}
                className={`${SEGMENT_BAR[i]} h-full transition-all`}
                style={{ width: `${s.percent}%` }}
                title={`${s.label}: ${s.formatted} (${s.percent} %)`}
              />
            ) : null,
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {view.segments.map((s, i) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${SEGMENT_BAR[i]}`} aria-hidden="true" />
              {s.label} · {s.percent} %
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {view.segments.map((s) => {
          const Icon = SEGMENT_ICON[s.key];
          return (
            <div key={s.key} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{s.formatted}</div>
                <p className="text-xs text-muted-foreground">{SEGMENT_HINT[s.key](s.count)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Uso frente a la cuota configurada en Ajustes (alerta al 90 %, HU-033) */}
      {storage.quotaGb !== null && storage.usagePercent !== null && view.quotaTone ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uso del almacenamiento frente a la cuota</span>
            <span className="font-medium text-foreground">
              {storage.totalStorageFormatted} de {storage.quotaGb} GB ({storage.usagePercent} %)
            </span>
          </div>
          <div
            className="h-2 w-full bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={storage.usagePercent}
            aria-valuetext={`${storage.usagePercent} % de la cuota`}
          >
            <div className={`${TONE_BAR[view.quotaTone]} h-full`} style={{ width: `${Math.min(100, Math.max(1, storage.usagePercent))}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sin cuota de almacenamiento configurada en Ajustes.</p>
      )}
    </section>
  );
}
