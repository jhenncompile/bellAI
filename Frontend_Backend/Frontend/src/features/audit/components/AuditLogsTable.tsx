import { ClipboardList } from 'lucide-react';
import type { AuditLog } from '../types/audit.types';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, formatAuditChanges } from '../types/audit.types';

interface AuditLogsTableProps {
  logs: AuditLog[];
}

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center">
        <ClipboardList className="size-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <h2 className="font-semibold text-foreground text-lg">Sin eventos de auditoría</h2>
        <p className="text-sm text-muted-foreground mt-1">No existen eventos para los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-3.5 px-5">Fecha y hora</th>
              <th className="py-3.5 px-5">Acción</th>
              <th className="py-3.5 px-5">Entidad</th>
              <th className="py-3.5 px-5">Identificador</th>
              <th className="py-3.5 px-5">Administrador</th>
              <th className="py-3.5 px-5">Detalle</th>
              <th className="py-3.5 px-5">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-4 px-5 whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                </td>
                <td className="py-4 px-5 font-medium text-foreground">
                  {AUDIT_ACTION_LABELS[log.action] || log.action}
                </td>
                <td className="py-4 px-5">
                  <span className="px-2.5 py-1 rounded-full bg-secondary border border-border text-xs">
                    {AUDIT_ENTITY_LABELS[log.entityType] || log.entityType}
                  </span>
                </td>
                <td className="py-4 px-5 font-mono text-xs text-muted-foreground max-w-44 break-all">
                  {log.entityId ?? 'No disponible'}
                </td>
                <td className="py-4 px-5 font-mono text-xs text-muted-foreground max-w-44 break-all">
                  {log.actorUserId ?? 'Actor no disponible'}
                </td>
                <td className="py-4 px-5 text-xs text-foreground">{formatAuditChanges(log)}</td>
                <td className="py-4 px-5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      log.success
                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                        : 'bg-destructive/15 text-destructive border-destructive/30'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        log.success ? 'bg-emerald-500' : 'bg-destructive'
                      }`}
                    />
                    {log.success ? 'Exitoso' : 'Fallido'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date);
}
