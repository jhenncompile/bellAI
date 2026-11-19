import type { UserFilters, UserStatus } from '../types/user.types';

export const USERS_PAGE_SIZE = 20;

export function buildUsersRequestParams(filters: UserFilters): Record<string, string | number> {
  const search = filters.search?.trim();

  return {
    ...(search ? { search } : {}),
    ...(filters.role && filters.role !== 'all' ? { role: filters.role } : {}),
    ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? USERS_PAGE_SIZE,
  };
}

export const USER_STATUS_PRESENTATION: Record<
  UserStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  active: {
    label: 'Activo',
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
    dotClass: 'bg-primary',
  },
  inactive: {
    label: 'Inactivo',
    badgeClass: 'bg-secondary text-secondary-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
  suspended: {
    label: 'Suspendido',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    dotClass: 'bg-destructive',
  },
};
