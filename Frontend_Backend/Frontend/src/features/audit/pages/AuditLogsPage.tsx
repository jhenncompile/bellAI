import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { AuditFilters } from '../components/AuditFilters';
import { AuditLogsTable } from '../components/AuditLogsTable';
import { auditService } from '../services/audit.service';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';
import type { AuditAction, AuditEntityType, AuditLogParams } from '../types/audit.types';

const PAGE_SIZE = 20;

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [entityType, setEntityType] = useState<AuditEntityType | 'all'>('all');

  const params: AuditLogParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(action !== 'all' ? { action } : {}),
    ...(entityType !== 'all' ? { entityType } : {}),
  };

  const auditQuery = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditService.getAuditLogs(params),
  });

  const handleActionChange = (value: AuditAction | 'all') => {
    setAction(value);
    setPage(1);
  };

  const handleEntityTypeChange = (value: AuditEntityType | 'all') => {
    setEntityType(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de auditoría</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consulta las acciones administrativas y de seguridad registradas por BellAI.
          </p>
        </div>
      </div>

      <AuditFilters
        action={action}
        entityType={entityType}
        disabled={auditQuery.isFetching}
        onActionChange={handleActionChange}
        onEntityTypeChange={handleEntityTypeChange}
      />

      {auditQuery.isLoading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-64 rounded-2xl bg-muted/50 border border-border animate-pulse" />
          <p className="text-sm text-muted-foreground" role="status">
            Cargando historial de auditoría...
          </p>
        </div>
      )}

      {auditQuery.error && (
        <AuditError
          error={auditQuery.error}
          onRetry={() => {
            void auditQuery.refetch();
          }}
        />
      )}

      {!auditQuery.isLoading && !auditQuery.error && auditQuery.data && (
        <>
          <AuditLogsTable logs={auditQuery.data.logs} />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{auditQuery.data.pagination.total} evento(s) registrado(s)</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={page <= 1 || auditQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {auditQuery.data.pagination.page} de{' '}
                {Math.max(auditQuery.data.pagination.totalPages, 1)}
              </span>
              <Button
                variant="outline"
                disabled={page >= auditQuery.data.pagination.totalPages || auditQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AuditError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = getApiErrorStatus(error);
  const title =
    status === 403
      ? 'Acceso denegado'
      : status === 401
      ? 'Sesión expirada'
      : 'No se pudo cargar el historial';

  return (
    <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
      <AlertTriangle className="size-10 mx-auto text-destructive" />
      <div>
        <h2 className="font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {getApiErrorMessage(error, 'No fue posible consultar el historial de auditoría.')}
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
