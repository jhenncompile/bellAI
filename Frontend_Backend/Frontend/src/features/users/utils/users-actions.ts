import type { AppUser, UserRole } from '../types/user.types';

export function getAvailableUserActions(user: AppUser, currentUserId?: string) {
  const isCurrentUser = user.id === currentUserId;

  return {
    canSuspend: user.status === 'active' && !isCurrentUser,
    canReactivate: user.status === 'suspended' && !isCurrentUser,
    canChangeRole: !(isCurrentUser && user.role === 'admin'),
  };
}

export function canSubmitRoleChange(
  user: AppUser,
  nextRole: UserRole,
  currentUserId?: string,
): boolean {
  if (nextRole === user.role) return false;
  return !(user.id === currentUserId && user.role === 'admin' && nextRole !== 'admin');
}
