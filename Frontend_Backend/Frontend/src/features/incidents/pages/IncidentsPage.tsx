import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, LifeBuoy, Loader2, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { incidentsService } from '../services/incidents.service';
import {
  PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS,
  type Incident, type IncidentFilters, type IncidentPriority, type IncidentStatus, type IncidentType,
} from '../types/incidents.types';

const PRIORITY_STYLE: Record<IncidentPriority, string> = {
  alta: 'bg-destructive/15 text-destructive border-destructive/30',
  media: 'bg-primary/10 text-primary border-primary/25',
  baja: 'bg-muted text-muted-foreground border-border',
};
const field = 'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground';

export function IncidentsPage() {
  const [filters, setFilters] = useState<IncidentFilters>({ page: 1 });
  const [selected, setSelected] = useState<Incident | null>(null);
  const listQuery = useQuery({ queryKey: ['incidents', filters], queryFn: () => incidentsService.list(filters) });
  const statsQuery = useQuery({ queryKey: ['incidents-stats'], queryFn: incidentsService.stats });

  const set = (patch: Partial<IncidentFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <LifeBuoy className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidencias</h1>
          <p className="text-sm text-muted-foreground mt-1">Problemas y sugerencias reportados por las usuarias desde la app.</p>
        </div>
      </div>

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          ['Abiertas', stats?.open],
          ['En proceso', stats?.inProgress],
          ['Resueltas', stats?.resolved],
          ['Prioridad alta pendientes', stats?.highPriority],
          ['Tiempo medio de resolución', stats?.avgResolutionHours ? `${stats.avgResolutionHours} h` : '—'],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{value ?? '…'}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <input aria-label="Buscar incidencias" className={`${field} pl-8 w-56`} placeholder="Buscar..." value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value || undefined })} />
        </div>
        <select aria-label="Estado" className={field} value={filters.status ?? ''} onChange={(e) => set({ status: (e.target.value || undefined) as IncidentStatus | undefined })}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Tipo" className={field} value={filters.type ?? ''} onChange={(e) => set({ type: (e.target.value || undefined) as IncidentType | undefined })}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Prioridad" className={field} value={filters.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || undefined) as IncidentPriority | undefined })}>
          <option value="">Todas las prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
          {listQuery.isLoading && <p className="p-6 text-sm text-muted-foreground" role="status">Cargando incidencias...</p>}
          {listQuery.error && (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle className="size-8 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">{getApiErrorMessage(listQuery.error, 'No se pudieron cargar las incidencias.')}</p>
              <Button variant="outline" onClick={() => void listQuery.refetch()}>Reintentar</Button>
            </div>
          )}
          {listQuery.data && listQuery.data.data.length === 0 && <p className="p-6 text-sm text-muted-foreground">No hay incidencias con estos filtros.</p>}
          <ul>
            {listQuery.data?.data.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`w-full text-left p-4 border-b border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/60 ${selected?.id === i.id ? 'bg-muted/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground truncate">{i.title}</p>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full border text-xs font-semibold ${PRIORITY_STYLE[i.priority]}`}>{PRIORITY_LABELS[i.priority]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {TYPE_LABELS[i.type]} · {STATUS_LABELS[i.status]} · {i.userName ?? 'Cuenta eliminada'} · {new Date(i.createdAt).toLocaleString('es')}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {listQuery.data && listQuery.data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 text-sm">
              <Button size="sm" variant="outline" disabled={(filters.page ?? 1) <= 1} onClick={() => set({ page: (filters.page ?? 1) - 1 })}>Anterior</Button>
              <span className="text-muted-foreground">Página {listQuery.data.meta.page} de {listQuery.data.meta.totalPages}</span>
              <Button size="sm" variant="outline" disabled={(filters.page ?? 1) >= listQuery.data.meta.totalPages} onClick={() => set({ page: (filters.page ?? 1) + 1 })}>Siguiente</Button>
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          {selected ? <IncidentDetail key={selected.id} incident={selected} onSaved={setSelected} /> : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-sm text-muted-foreground text-center">Selecciona una incidencia para atenderla.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function IncidentDetail({ incident, onSaved }: { incident: Incident; onSaved: (i: Incident) => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [priority, setPriority] = useState<IncidentPriority>(incident.priority);
  const [response, setResponse] = useState(incident.response ?? '');
  const save = useMutation({
    mutationFn: () => incidentsService.update(incident.id, { status, priority, response: response.trim() || undefined }),
    onSuccess: (updated) => {
      onSaved(updated);
      void qc.invalidateQueries({ queryKey: ['incidents'] });
      void qc.invalidateQueries({ queryKey: ['incidents-stats'] });
    },
  });
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-foreground">{incident.title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{incident.userName ?? 'Cuenta eliminada'}{incident.userEmail ? ` · ${incident.userEmail}` : ''}</p>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{incident.description}</p>
      {Object.keys(incident.context || {}).length > 0 && (
        <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(incident.context, null, 2)}</pre>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Estado</span>
          <select className={`${field} w-full`} value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Prioridad</span>
          <select className={`${field} w-full`} value={priority} onChange={(e) => setPriority(e.target.value as IncidentPriority)}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="text-sm space-y-1 block">
        <span className="text-muted-foreground">Respuesta para la usuaria</span>
        <textarea className="w-full min-h-24 rounded-lg border border-border bg-background p-3 text-sm text-foreground" value={response} onChange={(e) => setResponse(e.target.value)} maxLength={4000} />
      </label>
      {save.error && <p className="text-sm text-destructive" role="alert">{getApiErrorMessage(save.error, 'No se pudo guardar.')}</p>}
      {save.isSuccess && <p className="text-sm text-primary" role="status">Cambios guardados.</p>}
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending && <Loader2 className="size-4 animate-spin mr-2" />}Guardar
      </Button>
    </div>
  );
}
