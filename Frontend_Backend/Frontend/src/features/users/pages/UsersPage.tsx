import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { Button } from '@/shared/components/ui/button';
import { AlertMessage, type FeedbackMessage } from '@/shared/components/feedback/AlertMessage';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';
import { UserFormModal } from '../components/UserFormModal';
import { UserRoleDialog } from '../components/UserRoleDialog';
import { UserStatusDialog } from '../components/UserStatusDialog';
import { UsersFilterBar } from '../components/UsersFilterBar';
import { UserTable } from '../components/UserTable';
import { usersService } from '../services/users.service';
import type {
  AppUser,
  CreateUserDTO,
  UserRole,
  UsersListResponse,
  UserStatus,
} from '../types/user.types';
import { USERS_PAGE_SIZE } from '../utils/users-query';

const SEARCH_DEBOUNCE_MS = 300;

interface StatusDialogState {
  user: AppUser;
  action: 'suspend' | 'reactivate';
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(null);
  const [roleDialogUser, setRoleDialogUser] = useState<AppUser | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const usersQueryKey = [
    'admin-users',
    { search, roleFilter, statusFilter, page, pageSize: USERS_PAGE_SIZE },
  ] as const;

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: () =>
      usersService.getUsers({
        search,
        role: roleFilter,
        status: statusFilter,
        page,
        pageSize: USERS_PAGE_SIZE,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      usersService.updateUserStatus(id, status),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersService.updateUserRole(id, role),
  });

  const refreshUsersAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    const refreshedPage = queryClient.getQueryData<UsersListResponse>(usersQueryKey);
    if (page > 1 && refreshedPage && refreshedPage.data.length === 0) {
      setPage((current) => Math.max(1, current - 1));
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value as UserRole | 'all');
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as UserStatus | 'all');
    setPage(1);
  };

  const handleCreateUser = async (dto: CreateUserDTO) => {
    try {
      setMessage(null);
      await usersService.createUser(dto);
      setMessage({ type: 'success', text: 'Usuario creado exitosamente.' });
      await usersQuery.refetch();
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, 'No se pudo crear el usuario.') });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;

    try {
      setMessage(null);
      await usersService.deleteUser(id);
      setMessage({ type: 'success', text: 'Usuario eliminado exitosamente.' });
      await usersQuery.refetch();
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, 'No se pudo eliminar el usuario.') });
    }
  };

  const openStatusDialog = (user: AppUser, action: 'suspend' | 'reactivate') => {
    statusMutation.reset();
    setStatusDialog({ user, action });
  };

  const handleStatusConfirm = async () => {
    if (!statusDialog || statusMutation.isPending) return;

    const { user, action } = statusDialog;
    const nextStatus: UserStatus = action === 'suspend' ? 'suspended' : 'active';
    try {
      setMessage(null);
      await statusMutation.mutateAsync({ id: user.id, status: nextStatus });
      await refreshUsersAfterMutation();
      setMessage({
        type: 'success',
        text: action === 'suspend' ? 'Cuenta suspendida exitosamente.' : 'Cuenta reactivada exitosamente.',
      });
      setStatusDialog(null);
    } catch {
      // El diálogo permanece abierto y muestra el error entregado por la API.
    }
  };

  const openRoleDialog = (user: AppUser) => {
    roleMutation.reset();
    setRoleDialogUser(user);
  };

  const handleRoleConfirm = async (role: UserRole) => {
    if (!roleDialogUser || roleMutation.isPending || role === roleDialogUser.role) return;

    try {
      setMessage(null);
      await roleMutation.mutateAsync({ id: roleDialogUser.id, role });
      await refreshUsersAfterMutation();
      setMessage({ type: 'success', text: 'Rol actualizado exitosamente.' });
      setRoleDialogUser(null);
    } catch {
      // El diálogo permanece abierto y muestra el error entregado por la API.
    }
  };

  const pagination = usersQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            Consulta las cuentas registradas, sus roles y su estado actual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${usersQuery.isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-md">
            <UserPlus className="size-4" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {message && <AlertMessage message={message} />}

      <UsersFilterBar
        search={searchInput}
        onSearchChange={handleSearchChange}
        roleFilter={roleFilter}
        onRoleFilterChange={handleRoleFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {usersQuery.error ? (
        <UsersQueryError
          error={usersQuery.error}
          onRetry={() => {
            void usersQuery.refetch();
          }}
        />
      ) : (
        <>
          <UserTable
            users={usersQuery.data?.data ?? []}
            currentUserId={currentUserId}
            onDelete={handleDeleteUser}
            onRequestStatus={openStatusDialog}
            onRequestRole={openRoleDialog}
            isLoading={usersQuery.isLoading}
          />

          {!usersQuery.isLoading && pagination && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{pagination.total} resultado(s)</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={page <= 1 || usersQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <span>
                  Página {pagination.page} de {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages || totalPages === 0 || usersQuery.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      {statusDialog && (
        <UserStatusDialog
          user={statusDialog.user}
          action={statusDialog.action}
          pending={statusMutation.isPending}
          errorMessage={
            statusMutation.error
              ? getApiErrorMessage(statusMutation.error, 'No se pudo actualizar el estado de la cuenta.')
              : undefined
          }
          onCancel={() => setStatusDialog(null)}
          onConfirm={() => void handleStatusConfirm()}
        />
      )}

      {roleDialogUser && (
        <UserRoleDialog
          user={roleDialogUser}
          currentUserId={currentUserId}
          pending={roleMutation.isPending}
          errorMessage={
            roleMutation.error
              ? getApiErrorMessage(roleMutation.error, 'No se pudo actualizar el rol de la cuenta.')
              : undefined
          }
          onCancel={() => setRoleDialogUser(null)}
          onConfirm={(role) => void handleRoleConfirm(role)}
        />
      )}
    </div>
  );
}

function UsersQueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = getApiErrorStatus(error);
  const title =
    status === 401
      ? 'Sesión inválida'
      : status === 403
        ? 'Acceso denegado'
        : 'No se pudo consultar las cuentas';

  return (
    <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
      <AlertTriangle className="size-10 mx-auto text-destructive" />
      <div>
        <h2 className="font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {getApiErrorMessage(error, 'No fue posible cargar la lista de usuarios.')}
        </p>
      </div>
      {status !== 401 && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4 mr-2" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
