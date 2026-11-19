import { Sun, Moon, Laptop } from 'lucide-react';
import type { ThemePreference } from '../types/profile.types';

interface ThemeSelectorCardProps {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}

const OPCIONES: { value: ThemePreference; label: string; icon: typeof Sun; iconClass: string }[] = [
  { value: 'light', label: 'Modo Claro', icon: Sun, iconClass: 'text-amber-500' },
  { value: 'dark', label: 'Modo Oscuro', icon: Moon, iconClass: 'text-indigo-400' },
  { value: 'system', label: 'Tema del Sistema', icon: Laptop, iconClass: 'text-slate-400' },
];

/** Selector de tema claro / oscuro / sistema. */
export function ThemeSelectorCard({ value, onChange }: ThemeSelectorCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <Sun className="size-4 text-primary" />
        Tema de la Interfaz
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPCIONES.map(({ value: option, label, icon: Icon, iconClass }) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all text-xs font-medium ${
              value === option
                ? 'border-primary bg-primary/10 text-primary shadow-xs'
                : 'border-border bg-input/20 text-muted-foreground hover:bg-input/40'
            }`}
          >
            <Icon className={`size-5 ${iconClass}`} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
