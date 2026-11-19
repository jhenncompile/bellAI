import { FileText, Clock } from 'lucide-react';
import { CONSENT_DEFINITIONS } from '../constants/consents';
import type { ConsentRecord } from '../types/privacy.types';

interface ConsentsCardProps {
  consents: ConsentRecord[];
  onToggle: (consentType: string, currentState: boolean) => void;
}

export function ConsentsCard({ consents, onToggle }: ConsentsCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <FileText className="size-5 text-primary" />
        Registro de Consentimientos Otorgados
      </h2>

      <div className="space-y-3">
        {CONSENT_DEFINITIONS.map((item) => {
          const consent = consents.find((c) => c.consentType === item.type);
          const isAccepted = consent ? consent.accepted : false;

          return (
            <div
              key={item.type}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-input/10 gap-3"
            >
              <div>
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                {consent && (
                  <p className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                    <Clock className="size-3" />
                    Registrado el: {new Date(consent.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onToggle(item.type, isAccepted)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  isAccepted
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
                }`}
              >
                {isAccepted ? 'Consentimiento Activo ✓' : 'Denegado / Inactivo ✗'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
