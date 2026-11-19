import { Phone, MapPin, Calendar, Lock } from 'lucide-react';
import type { ProfileFormValues } from '../types/profile.types';

interface ProfileSensitiveDataCardProps {
  values: ProfileFormValues;
  phoneMasked?: string;
  onChange: (patch: Partial<ProfileFormValues>) => void;
}

/** Datos personales que el backend cifra en reposo con AES-256-GCM. */
export function ProfileSensitiveDataCard({
  values,
  phoneMasked,
  onChange,
}: ProfileSensitiveDataCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          Datos Personales Protegidos y Cifrados
        </h2>
        <span className="text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
          AES-256-GCM
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Phone className="size-3.5" />
            Teléfono de Contacto
          </label>
          <input
            type="text"
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+591 71234567"
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          />
          {phoneMasked && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Enmascarado público: <code className="text-primary">{phoneMasked}</code>
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            Fecha de Nacimiento
          </label>
          <input
            type="date"
            value={values.birthDate}
            onChange={(e) => onChange({ birthDate: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            Dirección Física (Cifrada localmente)
          </label>
          <input
            type="text"
            value={values.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Av. Principal #123, Santa Cruz, Bolivia"
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          />
        </div>
      </div>
    </div>
  );
}
