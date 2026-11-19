import { Ban, CalendarDays, Shield, ShieldCog, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { getAvatarUrl } from '@/shared/lib/avatar';
import type { AppUser } from '../types/user.types';
import { getAvailableUserActions } from '../utils/users-actions';
import { USER_STATUS_PRESENTATION } from '../utils/users-query';

interface UserTableProps {
  users: AppUser[];
  currentUserId?: string;
  onDelete: (id: string) => void;
  onRequestStatus: (user: AppUser, action: 'suspend' | 'reactivate') => void;
  onRequestRole: (user: AppUser) => void;
  isLoading?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' });

export function UserTable({
  users,
  currentUserId,
  onDelete,
  onRequestStatus,
  onRequestRole,
  isLoading,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="w-full bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground animate-pulse">
        Cargando usuarios...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="w-full bg-card border border-border rounded-2xl p-12 text-center">
        <UserCheck className="size-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h3 className="font-semibold text-foreground text-lg">Sin resultados</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No se encontraron usuarios con los criterios de búsqueda seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-3.5 px-6">Usuario</th>
              <th className="py-3.5 px-6">Rol</th>
              <th className="py-3.5 px-6">Estado</th>
              <th className="py-3.5 px-6">Fecha de registro</th>
              <th className="py-3.5 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const status = USER_STATUS_PRESENTATION[user.status];
              const actions = getAvailableUserActions(user, currentUserId);
              return (
                <tr key={user.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAvatarUrl(user.email, user.avatar)}
                        alt={user.name}
                        className="size-9 rounded-full object-cover border border-border bg-muted"
                      />
                      <div>
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      <Shield className="size-3 text-primary" />
                      {user.role === 'admin'
                        ? 'Administrador'
                        : user.role === 'manager'
                          ? 'Gerente'
                          : 'Usuario App'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.badgeClass}`}
                    >
                      <span className={`size-1.5 rounded-full ${status.dotClass}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {formatCreatedAt(user.createdAt)}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-1">
                      {actions.canSuspend && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestStatus(user, 'suspend')}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          aria-label={`Suspender a ${user.name}`}
                        >
                          <Ban className="size-4 mr-1.5" />
                          Suspender
                        </Button>
                      )}
                      {actions.canReactivate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestStatus(user, 'reactivate')}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                          aria-label={`Reactivar a ${user.name}`}
                        >
                          <UserCheck className="size-4 mr-1.5" />
                          Reactivar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRequestRole(user)}
                        disabled={!actions.canChangeRole}
                        title={
                          actions.canChangeRole
                            ? 'Cambiar rol'
                            : 'No puedes degradar tu propia cuenta administradora'
                        }
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                        aria-label={`Cambiar rol de ${user.name}`}
                      >
                        <ShieldCog className="size-4 mr-1.5" />
                        Rol
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(user.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-2 transition-colors"
                        aria-label={`Eliminar a ${user.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date);
}
