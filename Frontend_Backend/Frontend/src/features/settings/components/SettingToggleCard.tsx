import { useState, type ReactNode } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { PlatformSetting, SettingValue } from '../types/settings.types';

interface SettingToggleCardProps {
  setting: PlatformSetting;
  icon?: ReactNode;
  isSaving: boolean;
  disabled?: boolean;
  onChange: (value: SettingValue) => void;
}

/**
 * Tarjeta de una configuración: interruptor para booleanos y campo con validación para números/textos.
 * El padre debe usar `key` con el valor guardado para reiniciar el borrador al cambiar.
 */
export function SettingToggleCard({ setting, icon, isSaving, disabled = false, onChange }: SettingToggleCardProps) {
  const controlId = `setting-${setting.key}`;
  const [draft, setDraft] = useState(String(setting.value));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (setting.type === 'number') {
      const n = Number(draft);
      if (draft.trim() === '' || !Number.isFinite(n)) return setError('Introduce un número válido.');
      if ((setting.min !== undefined && n < setting.min) || (setting.max !== undefined && n > setting.max)) {
        return setError(`Debe estar entre ${setting.min} y ${setting.max}.`);
      }
      setError(null);
      if (n !== setting.value) onChange(n);
      return;
    }
    const text = draft.trim();
    if (!text) return setError('El valor no puede estar vacío.');
    setError(null);
    if (text !== setting.value) onChange(text);
  };

  const changed = draft !== String(setting.value);

  return (
    <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-5">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <h3 id={`${controlId}-label`} className="font-bold text-foreground">
              {setting.label}
            </h3>
            <p id={`${controlId}-description`} className="text-sm text-muted-foreground">
              {setting.description}
            </p>
          </div>
        </div>
        {setting.type === 'boolean' && (
          <button
            id={controlId}
            type="button"
            role="switch"
            aria-checked={Boolean(setting.value)}
            aria-labelledby={`${controlId}-label`}
            aria-describedby={`${controlId}-description`}
            disabled={disabled || isSaving}
            onClick={() => onChange(!setting.value)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60 ${
              setting.value ? 'bg-primary border-primary' : 'bg-muted border-border'
            }`}
          >
            <span className={`size-5 rounded-full bg-background shadow-sm transition-transform ${setting.value ? 'translate-x-6' : 'translate-x-1'}`} />
            <span className="sr-only">
              {setting.value ? 'Desactivar' : 'Activar'} {setting.label}
            </span>
          </button>
        )}
      </div>

      {setting.type !== 'boolean' && (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 min-w-40">
            {setting.options?.length ? (
              <select
                id={controlId}
                aria-labelledby={`${controlId}-label`}
                value={draft}
                disabled={disabled || isSaving}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {setting.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={controlId}
                aria-labelledby={`${controlId}-label`}
                aria-invalid={Boolean(error)}
                type={setting.type === 'number' ? 'number' : 'text'}
                step="any"
                min={setting.min}
                max={setting.max}
                value={draft}
                disabled={disabled || isSaving}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            )}
            {error && (
              <p className="text-xs text-destructive mt-1" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={!changed || disabled || isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="ml-1.5">Guardar</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || isSaving || setting.value === setting.defaultValue}
            onClick={() => onChange(setting.defaultValue)}
            title="Restaurar valor por defecto"
          >
            <RotateCcw className="size-4" />
          </Button>
        </form>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {setting.type === 'boolean'
            ? `Estado: ${setting.value ? 'Activado' : 'Desactivado'}`
            : `Por defecto: ${String(setting.defaultValue)}${setting.min !== undefined ? ` · rango ${setting.min}–${setting.max}` : ''}`}
        </span>
        {isSaving && (
          <span className="inline-flex items-center gap-1.5" role="status">
            <Loader2 className="size-3.5 animate-spin" />
            Guardando...
          </span>
        )}
      </div>
    </section>
  );
}
