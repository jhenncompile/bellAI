import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface ForgetMeDialogProps {
  isOpen: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, password: string) => void;
}

/** Confirmación del derecho al olvido con la contraseña actual (CP-029-03). El motivo opcional no se conserva. */
export function ForgetMeDialog({ isOpen, deleting, onCancel, onConfirm }: ForgetMeDialogProps) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3 text-destructive">
          <ShieldAlert className="size-6" />
          <h3 className="font-bold text-base">¿Confirmar Derecho al Olvido?</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminarán tu cuenta, perfil, preferencias,
          armario y fotografías. No podrás volver a iniciar sesión con estas credenciales.
        </p>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Motivo de la solicitud (opcional; no se guarda)
          </label>
          <input
            type="text"
            placeholder="Ej. Cierre de cuenta por solicitud personal"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-input/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
          />
        </div>

        <div>
          <label htmlFor="forget-password" className="block text-xs font-medium text-foreground mb-1.5">
            Contraseña actual (obligatoria)
          </label>
          <input
            id="forget-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-input/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason, password)}
            disabled={deleting || !password}
            className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold shadow-xs hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Eliminando cuenta...' : 'Sí, eliminar mi cuenta y datos'}
          </button>
        </div>
      </div>
    </div>
  );
}
