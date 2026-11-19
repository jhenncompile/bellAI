import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, CircleSlash, Loader2, Plus, RefreshCw, Stethoscope, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { aiModelsService } from '../services/ai-models.service';
import type { AiModel, ModelEnvironment, ModelStatus } from '../types/ai-models.types';

const STATUS_STYLE: Record<ModelStatus, string> = {
  activo: 'bg-primary/15 text-primary border-primary/30',
  registrado: 'bg-muted text-muted-foreground border-border',
  inactivo: 'bg-muted text-muted-foreground border-border',
  fallido: 'bg-destructive/15 text-destructive border-destructive/30',
};
const ENVIRONMENTS: ModelEnvironment[] = ['desarrollo', 'pruebas', 'produccion'];
const TASK_LABELS: Record<string, string> = { diagnostico: 'Diagnóstico', simulacion: 'Simulación' };

export function AiModelsPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const modelsQuery = useQuery({ queryKey: ['ai-models'], queryFn: aiModelsService.list });
  const statsQuery = useQuery({ queryKey: ['task-stats'], queryFn: aiModelsService.taskStats, refetchInterval: 30_000 });

  const run = useMutation({
    mutationFn: async ({ action, model }: { action: 'check' | 'activate' | 'deactivate'; model: AiModel }) => {
      if (action === 'check') return aiModelsService.check(model.id);
      if (action === 'activate') return aiModelsService.activate(model.id);
      return aiModelsService.deactivate(model.id);
    },
    onSuccess: (_data, { action, model }) => {
      const text = {
        check: `Comprobación de ${model.name}@${model.version} completada.`,
        activate: `${model.name}@${model.version} está activo en ${model.environment}.`,
        deactivate: `${model.name}@${model.version} quedó inactivo.`,
      }[action];
      setMessage({ kind: 'ok', text });
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (error) => {
      setMessage({ kind: 'error', text: getApiErrorMessage(error, 'No se pudo completar la acción.') });
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });

  const upload = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => aiModelsService.uploadArtifact(id, file),
    onSuccess: (m) => {
      setMessage({ kind: 'ok', text: `Archivo subido para ${m.name}@${m.version}.` });
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (error) => setMessage({ kind: 'error', text: getApiErrorMessage(error, 'No se pudo subir el archivo del modelo.') }),
  });

  const sync = useMutation({
    mutationFn: aiModelsService.sync,
    onSuccess: (data) => {
      setMessage({ kind: 'ok', text: data.created.length ? `Registrados: ${data.created.join(', ')}` : 'No había analizadores nuevos.' });
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (error) => setMessage({ kind: 'error', text: getApiErrorMessage(error, 'El servicio de IA no respondió.') }),
  });

  const data = modelsQuery.data;
  const active = (data?.models ?? []).filter((m) => m.status === 'activo');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Modelos de IA</h1>
            <p className="text-sm text-muted-foreground mt-1">Versiones registradas, versión activa por entorno y comprobación de compatibilidad.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="ml-2">Importar del servicio</span>
          </Button>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            <span className="ml-2">Registrar versión</span>
          </Button>
        </div>
      </div>

      {message && (
        <div role={message.kind === 'error' ? 'alert' : 'status'} className={`p-4 text-sm rounded-xl border ${message.kind === 'error' ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-primary/10 text-foreground border-primary/25'}`}>
          {message.text}
        </div>
      )}

      {showForm && data && <RegisterForm analyzers={data.serviceAnalyzers.map((a) => ({ name: a.name, task: a.task }))} defaultEnv={data.environment} onDone={(text) => { setShowForm(false); setMessage({ kind: 'ok', text }); void qc.invalidateQueries({ queryKey: ['ai-models'] }); }} />}

      {modelsQuery.isLoading && <p className="text-sm text-muted-foreground" role="status">Cargando modelos...</p>}
      {modelsQuery.error && (
        <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="size-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">{getApiErrorMessage(modelsQuery.error, 'No se pudieron cargar los modelos.')}</p>
          <Button variant="outline" onClick={() => void modelsQuery.refetch()}>Reintentar</Button>
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Servicio de IA</p>
              <p className={`mt-2 font-bold ${data.serviceOnline ? 'text-primary' : 'text-destructive'}`}>{data.serviceOnline ? 'En línea' : 'Sin conexión'}</p>
              <p className="text-xs text-muted-foreground mt-1">Entorno de este servidor: {data.environment}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Versión activa por entorno</p>
              {active.length ? (
                <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm">
                  {active.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-primary" />
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="text-muted-foreground">{m.version} · {m.environment}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">Ningún modelo activo todavía. Importa los analizadores y actívalos.</p>
              )}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Modelo</th>
                  <th className="p-3">Versión</th>
                  <th className="p-3">Entorno</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Última comprobación</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.models.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">No hay modelos registrados.</td>
                  </tr>
                )}
                {data.models.map((m) => {
                  const busy = run.isPending && run.variables?.model.id === m.id;
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.description || m.task}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{m.version}</td>
                      <td className="p-3">{m.environment}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                      </td>
                      <td className="p-3 text-xs">
                        {m.lastCheck ? (
                          <span className={m.lastCheck.compatible ? 'text-primary' : 'text-destructive'}>
                            {m.lastCheck.compatible ? `Compatible${m.lastCheck.latencyMs ? ` (${m.lastCheck.latencyMs} ms)` : ''}` : m.lastCheck.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sin comprobar</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          <label className={`inline-flex items-center justify-center h-8 px-2.5 rounded-md border border-border text-xs cursor-pointer hover:bg-muted ${upload.isPending ? 'opacity-50 pointer-events-none' : ''}`} title="Subir archivo del modelo (.onnx, .pt, .tflite, .task, .glb…)">
                            <Upload className="size-4" />
                            <span className="sr-only">Subir archivo del modelo {m.name}</span>
                            <input
                              type="file"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) upload.mutate({ id: m.id, file });
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'check', model: m })} title="Comprobar compatibilidad">
                            {busy ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
                          </Button>
                          {m.status === 'activo' ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => run.mutate({ action: 'deactivate', model: m })}>
                              <CircleSlash className="size-4" />
                              <span className="ml-1">Desactivar</span>
                            </Button>
                          ) : (
                            <Button size="sm" disabled={busy} onClick={() => run.mutate({ action: 'activate', model: m })}>
                              Activar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="font-bold text-foreground">Tareas de IA (últimos 30 días)</h2>
        </div>
        {statsQuery.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statsQuery.data.map((s) => (
              <div key={s.type} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-foreground">{TASK_LABELS[s.type] ?? s.type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.total} en total · {s.completed} completadas · {s.failed} fallidas · {s.active} en curso
                </p>
                <p className="text-xs text-muted-foreground">Tiempo medio: {s.avgSeconds ? `${s.avgSeconds} s` : '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{statsQuery.isLoading ? 'Cargando métricas...' : 'Aún no hay tareas registradas.'}</p>
        )}
      </section>
    </div>
  );
}

function RegisterForm({ analyzers, defaultEnv, onDone }: { analyzers: { name: string; task: string }[]; defaultEnv: ModelEnvironment; onDone: (text: string) => void }) {
  const [name, setName] = useState(analyzers[0]?.name ?? '');
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState<ModelEnvironment>(defaultEnv);
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: aiModelsService.create,
    onSuccess: (m) => onDone(`Registrada la versión ${m.version} de ${m.name}.`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const task = analyzers.find((a) => a.name === name)?.task ?? 'otro';
    create.mutate({ name, task, version: version.trim(), environment, description: description.trim() || undefined });
  };
  const field = 'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground';
  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-5 grid gap-3 md:grid-cols-4 items-end">
      <label className="text-sm space-y-1">
        <span className="text-muted-foreground">Analizador</span>
        <select className={field} value={name} onChange={(e) => setName(e.target.value)}>
          {analyzers.map((a) => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>
      </label>
      <label className="text-sm space-y-1">
        <span className="text-muted-foreground">Versión</span>
        <input className={field} required value={version} onChange={(e) => setVersion(e.target.value)} placeholder="face-geometry-1.1.0" />
      </label>
      <label className="text-sm space-y-1">
        <span className="text-muted-foreground">Entorno</span>
        <select className={field} value={environment} onChange={(e) => setEnvironment(e.target.value as ModelEnvironment)}>
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={create.isPending || !version.trim()}>
        {create.isPending && <Loader2 className="size-4 animate-spin mr-2" />}Registrar
      </Button>
      <label className="text-sm space-y-1 md:col-span-4">
        <span className="text-muted-foreground">Descripción (opcional)</span>
        <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {create.error && (
        <p className="text-sm text-destructive md:col-span-4" role="alert">{getApiErrorMessage(create.error, 'No se pudo registrar la versión.')}</p>
      )}
    </form>
  );
}
