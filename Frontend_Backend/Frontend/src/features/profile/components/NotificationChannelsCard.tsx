import { Bell, Mail } from 'lucide-react';
import type { PreferencesFormValues } from '../types/profile.types';

interface NotificationChannelsCardProps {
  values: PreferencesFormValues;
  onChange: (patch: Partial<PreferencesFormValues>) => void;
}

/** Canales por los que el usuario acepta recibir notificaciones. */
export function NotificationChannelsCard({ values, onChange }: NotificationChannelsCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <Bell className="size-4 text-primary" />
        Canales de Notificación
      </h2>

      <div className="space-y-4">
        <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-input/10 cursor-pointer hover:bg-input/20 transition-colors">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                Alertas por Correo Electrónico
              </p>
              <p className="text-[11px] text-muted-foreground">
                Recibe reportes de actividad y alertas críticas en tu bandeja de entrada.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={values.emailNotifications}
            onChange={(e) => onChange({ emailNotifications: e.target.checked })}
            className="size-4 rounded-sm border-border text-primary focus:ring-primary"
          />
        </label>

        <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-input/10 cursor-pointer hover:bg-input/20 transition-colors">
          <div className="flex items-center gap-3">
            <Bell className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-foreground">Notificaciones Push en Vivo</p>
              <p className="text-[11px] text-muted-foreground">
                Alertas en el navegador o dispositivo móvil cuando haya nuevas tareas.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={values.pushNotifications}
            onChange={(e) => onChange({ pushNotifications: e.target.checked })}
            className="size-4 rounded-sm border-border text-primary focus:ring-primary"
          />
        </label>
      </div>
    </div>
  );
}
