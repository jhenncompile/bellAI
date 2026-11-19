export const AUDIT_ACTIONS = [
  'PLATFORM_SETTING_UPDATED',
  'USER_CREATED',
  'USER_ROLE_CHANGED',
  'USER_STATUS_CHANGED',
  'USER_DELETED',
] as const;

export const AUDIT_ENTITY_TYPES = ['user', 'platform_setting'] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];
export type AuditEntityType = typeof AUDIT_ENTITY_TYPES[number];

export type AuditChanges =
  | { previousValue: boolean; newValue: boolean }
  | { role: 'admin' | 'manager' | 'user' }
  | { previousRole: 'admin' | 'manager' | 'user'; newRole: 'admin' | 'manager' | 'user' }
  | { previousStatus: 'active' | 'inactive' | 'suspended'; newStatus: 'active' | 'inactive' | 'suspended' }
  | Record<string, unknown>
  | null;

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  changes: AuditChanges;
  success: boolean;
  createdAt: string;
}

export interface AuditPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: AuditPagination;
}

export interface AuditLogParams {
  page: number;
  pageSize: number;
  action?: AuditAction;
  entityType?: AuditEntityType;
}

export const isAuditAction = (value: unknown): value is AuditAction =>
  typeof value === 'string' && AUDIT_ACTIONS.includes(value as AuditAction);

export const isAuditEntityType = (value: unknown): value is AuditEntityType =>
  typeof value === 'string' && AUDIT_ENTITY_TYPES.includes(value as AuditEntityType);

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  PLATFORM_SETTING_UPDATED: 'Configuración actualizada',
  USER_CREATED: 'Usuario creado',
  USER_ROLE_CHANGED: 'Rol de usuario modificado',
  USER_STATUS_CHANGED: 'Estado de usuario modificado',
  USER_DELETED: 'Usuario eliminado',
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  user: 'Usuario',
  platform_setting: 'Configuración',
};

export function formatAuditChanges(log: AuditLog): string {
  const changes = log.changes;
  if (log.action === 'USER_DELETED') return 'Entidad eliminada';
  if (!changes) return 'Sin detalle disponible';
  if ('previousValue' in changes) {
    return `${changes.previousValue ? 'Activado' : 'Desactivado'} → ${changes.newValue ? 'Activado' : 'Desactivado'}`;
  }
  if ('role' in changes) return `Rol asignado: ${changes.role}`;
  if ('previousRole' in changes && 'newRole' in changes) return `${changes.previousRole} → ${changes.newRole}`;
  if ('previousStatus' in changes && 'newStatus' in changes) return `${changes.previousStatus} → ${changes.newStatus}`;
  return JSON.stringify(changes);
}
