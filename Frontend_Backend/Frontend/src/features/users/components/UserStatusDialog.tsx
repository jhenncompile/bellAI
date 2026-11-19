import { AlertTriangle, Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { AppUser } from '../types/user.types';

interface UserStatusDialogProps {
  user: AppUser;
  action: 'suspend' | 'reactivate';
  pending: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UserStatusDialog({
  user,
  action,
  pending,
  errorMessage,
  onCancel,
  onConfirm,
}: UserStatusDialogProps) {
  const isSuspension = action === 'suspend';
  const titleId = 'user-status-dialog-title';
  const descriptionId = 'user-status-dialog-description';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className={`flex items-center gap-3 ${isSuspension ? 'text-destructive' : 'text-primary'}`}>
          {isSuspension ? <AlertTriangle className="size-6" /> : <UserCheck className="size-6" />}
          <h2 id={titleId} className="text-lg font-bold">
            {isSuspension ? 'Suspender cuenta' : 'Reactivar cuenta'}
          </h2>
        </div>

        <div id={descriptionId} className="space-y-2 text-sm text-muted-foreground">
          <p>
            Cuenta seleccionada: <strong className="text-foreground">{user.name}</strong>
          </p>
          <p>
            {isSuspension
              ? 'La cuenta no podrá iniciar sesión ni utilizar endpoints protegidos mientras permanezca suspendida.'
              : 'La cuenta recuperará el acceso y podrá volver a iniciar sesión.'}
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isSuspension ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
            {pending
              ? 'Procesando...'
              : isSuspension
                ? 'Confirmar suspensión'
                : 'Confirmar reactivación'}
          </Button>
        </div>
      </div>
    </div>
  );
}
