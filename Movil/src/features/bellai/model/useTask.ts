import { useCallback, useEffect, useRef, useState } from 'react';
import { tasksApi } from '../api/bellaiApi';
import { friendlyMessage } from '@/shared/api/http';
import type { TaskView } from '../api/types';

const POLL_MS = 1500;
const MAX_WAIT_MS = 3 * 60 * 1000;

/**
 * HU-041: sigue una tarea asíncrona del backend hasta que termina.
 * La usuaria puede seguir usando otras secciones; si falla o tarda demasiado puede reintentar.
 */
export function useTask<R = any>() {
  const [task, setTask] = useState<TaskView<R> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const poll = useCallback((id: string) => {
    const step = async () => {
      try {
        const t = await tasksApi.get<R>(id);
        if (!alive.current) return;
        setTask(t);
        if (t.status === 'completada' || t.status === 'fallida') return;
        if (Date.now() - startedAt.current > MAX_WAIT_MS) {
          setError('El análisis está tardando más de lo normal. Puedes reintentarlo.');
          return;
        }
        timer.current = setTimeout(() => void step(), POLL_MS);
      } catch (err) {
        if (!alive.current) return;
        setError(friendlyMessage(err, 'Perdimos la conexión mientras se procesaba. Puedes reintentar.'));
      }
    };
    void step();
  }, []);

  /** Empieza a seguir una tarea recién creada. */
  const track = useCallback((initial: TaskView<R>) => {
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    setTask(initial);
    startedAt.current = Date.now();
    if (initial.status !== 'completada' && initial.status !== 'fallida') {
      timer.current = setTimeout(() => poll(initial.id), POLL_MS);
    }
  }, [poll]);

  const retry = useCallback(async () => {
    if (!task) return;
    setError(null);
    try {
      const t = task.status === 'fallida' ? await tasksApi.retry<R>(task.id) : task;
      track(t);
    } catch (err) {
      setError(friendlyMessage(err));
    }
  }, [task, track]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setTask(null);
    setError(null);
  }, []);

  const running = Boolean(task && (task.status === 'pendiente' || task.status === 'procesando') && !error);
  return {
    task,
    running,
    progress: task?.progress ?? 0,
    result: task?.status === 'completada' ? task.result : null,
    failure: error ?? (task?.status === 'fallida' ? task.error || 'No pudimos completar el análisis.' : null),
    track,
    retry,
    reset,
  };
}
