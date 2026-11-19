import type { User } from '../types/auth.types';

export type AdminAccessDecision = 'loading' | 'login' | 'allowed' | 'denied';

interface AdminAccessState {
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasToken: boolean;
  isValidating: boolean;
  validatedUser?: User;
  validationErrorStatus?: number | null;
  validationFailed?: boolean;
}

export function getAdminAccessDecision({
  isHydrated,
  isAuthenticated,
  hasToken,
  isValidating,
  validatedUser,
  validationErrorStatus,
  validationFailed = false,
}: AdminAccessState): AdminAccessDecision {
  if (!isHydrated) return 'loading';
  if (!isAuthenticated || !hasToken) return 'login';
  if (isValidating) return 'loading';
  if (validationErrorStatus === 401) return 'login';
  if (validationFailed || !validatedUser) return 'denied';
  return validatedUser.role === 'admin' ? 'allowed' : 'denied';
}
