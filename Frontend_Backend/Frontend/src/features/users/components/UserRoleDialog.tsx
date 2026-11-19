import { useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { AppUser, UserRole } from '../types/user.types';
import { canSubmitRoleChange } from '../utils/users-actions';

interface UserRoleDialogProps {
  user: AppUser;
  currentUserId?: string;
  pending: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (role: UserRole) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Manager',
  user: 'Usuario',
};

export function UserRoleDialog({
  user,
  currentUserId,
  pending,
  errorMessage,
  onCancel,
  onConfirm,
}: UserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [confirming, setConfirming] = useState(false);
  const canSubmit = canSubmitRoleChange(user, selectedRole, currentUserId);
  const titleId = 'user-role-dialog-title';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center gap-3 text-primary">
          <Shield className="size-6" />
          <h2 id={titleId} className="text-lg font-bold text-foreground">Cambiar rol</h2>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p><strong className="text-foreground">{user.name}</strong></p>
          <p>Rol actual: {ROLE_LABELS[user.role]}</p>
        </div>

        {!confirming ? (
          <div>
            <label htmlFor="new-user-role" className="block text-sm font-medium text-foreground mb-2">
              Nuevo rol
            </label>
            <select
              id="new-user-role"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as UserRole)}
              disabled={pending}
              className="w-full px-3 py-2 bg-input/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="user">Usuario</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        ) : (
          <p className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-foreground">
            Confirma el cambio de <strong>{ROLE_LABELS[user.role]}</strong> a{' '}
            <strong>{ROLE_LABELS[selectedRole]}</strong>.
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={confirming ? () => setConfirming(false) : onCancel}
            disabled={pending}
          >
            {confirming ? 'Volver' : 'Cancelar'}
          </Button>
          {!confirming ? (
            <Button type="button" onClick={() => setConfirming(true)} disabled={!canSubmit || pending}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={() => onConfirm(selectedRole)} disabled={!canSubmit || pending}>
              {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {pending ? 'Guardando...' : 'Confirmar cambio'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
