import type { AuditAction, AuditEntityType } from '../types/audit.types';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '../types/audit.types';

interface AuditFiltersProps {
  action: AuditAction | 'all';
  entityType: AuditEntityType | 'all';
  disabled?: boolean;
  onActionChange: (value: AuditAction | 'all') => void;
  onEntityTypeChange: (value: AuditEntityType | 'all') => void;
}

export function AuditFilters({
  action,
  entityType,
  disabled = false,
  onActionChange,
  onEntityTypeChange,
}: AuditFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
      <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
        Acción administrativa
        <select
          value={action}
          disabled={disabled}
          onChange={(event) => onActionChange(event.target.value as AuditAction | 'all')}
          className="w-full px-3 py-2.5 bg-input/40 border border-border rounded-xl text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        >
          <option value="all">Todas las acciones</option>
          {AUDIT_ACTIONS.map((item) => (
            <option key={item} value={item}>
              {AUDIT_ACTION_LABELS[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
        Tipo de entidad
        <select
          value={entityType}
          disabled={disabled}
          onChange={(event) => onEntityTypeChange(event.target.value as AuditEntityType | 'all')}
          className="w-full px-3 py-2.5 bg-input/40 border border-border rounded-xl text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        >
          <option value="all">Todos los tipos</option>
          <option value="user">{AUDIT_ENTITY_LABELS.user}</option>
          <option value="platform_setting">{AUDIT_ENTITY_LABELS.platform_setting}</option>
        </select>
      </label>
    </div>
  );
}
