import { Globe, Cookie, Target } from 'lucide-react';
import type { PreferencesFormValues } from '../types/profile.types';

interface LanguageConsentsCardProps {
  values: PreferencesFormValues;
  onChange: (patch: Partial<PreferencesFormValues>) => void;
}

/** Idioma de la plataforma y consentimientos opcionales de marketing / telemetría. */
export function LanguageConsentsCard({ values, onChange }: LanguageConsentsCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <Globe className="size-4 text-primary" />
        Idioma y Consentimientos Adicionales
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Idioma de la Plataforma
          </label>
          <select
            value={values.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          >
            <option value="es">Español (América Latina / Bolivia)</option>
            <option value="en">English (United States)</option>
          </select>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={values.marketingConsent}
              onChange={(e) => onChange({ marketingConsent: e.target.checked })}
              className="size-4 rounded-sm border-border text-primary focus:ring-primary"
            />
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Target className="size-3.5 text-primary" />
              Boletines informativos y novedades del sistema
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={values.trackingConsent}
              onChange={(e) => onChange({ trackingConsent: e.target.checked })}
              className="size-4 rounded-sm border-border text-primary focus:ring-primary"
            />
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Cookie className="size-3.5 text-amber-500" />
              Cookies de telemetría y rendimiento anónimo
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
