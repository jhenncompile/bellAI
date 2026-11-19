import { ShieldAlert, Trash2 } from 'lucide-react';

interface DangerZoneCardProps {
  onRequestDeletion: () => void;
}

/** Zona de peligro: inicia la solicitud de derecho al olvido (Art. 17 RGPD). */
export function DangerZoneCard({ onRequestDeletion }: DangerZoneCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-4 shadow-xs">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-destructive flex items-center gap-2">
          <ShieldAlert className="size-5" />
          Zona de Peligro: Derecho al Olvido (Art. 17 RGPD)
        </h2>
        <p className="text-xs text-muted-foreground">
          Solicita la supresión y anonimización irreversible de todos tus datos personales asociados
          a esta cuenta. Tu nombre, correo, teléfono y dirección serán purgados de la base de datos
          de forma no recuperable.
        </p>
      </div>

      <button
        onClick={onRequestDeletion}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold shadow-xs hover:bg-destructive/90 transition-colors"
      >
        <Trash2 className="size-4" />
        Solicitar Supresión y Anonimización de Cuenta
      </button>
    </div>
  );
}
