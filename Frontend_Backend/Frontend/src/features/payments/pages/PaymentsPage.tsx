import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { paymentsService } from '../services/payments.service';
import { PAYMENT_STATUS_LABELS, formatMoney, type PaymentStatus } from '../types/payments.types';

const STATUS_STYLE: Record<PaymentStatus, string> = {
  paid: 'bg-primary/10 text-primary border-primary/25',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  expired: 'bg-muted text-muted-foreground border-border',
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Suscripciones: suscriptoras Premium activas, ingresos del mes y últimos pagos (solo lectura). */
export function PaymentsPage() {
  const query = useQuery({ queryKey: ['admin-payments'], queryFn: paymentsService.overview });
  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <CreditCard className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suscripciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan Premium mensual pagado con Stripe. Los pagos se aprueban solos en la pasarela.
            {data?.testMode ? ' Modo de prueba: no se mueve dinero real.' : ''}
          </p>
        </div>
      </div>

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          ['Suscriptoras Premium activas', data?.activeSubscribers],
          ['Ingresos del mes', data ? formatMoney(data.monthRevenueCents, data.currency) : undefined],
          ['Pagos pendientes', data?.pendingPayments],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{value ?? '…'}</p>
          </div>
        ))}
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        {query.isLoading && <p className="p-6 text-sm text-muted-foreground" role="status">Cargando pagos...</p>}
        {query.error && (
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="size-8 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">{getApiErrorMessage(query.error, 'No se pudieron cargar los pagos.')}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>
          </div>
        )}
        {data && data.payments.length === 0 && <p className="p-6 text-sm text-muted-foreground">Todavía no hay pagos.</p>}
        {data && data.payments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 font-medium">Usuaria</th>
                  <th className="p-3 font-medium">Monto</th>
                  <th className="p-3 font-medium">Estado</th>
                  <th className="p-3 font-medium">Creado</th>
                  <th className="p-3 font-medium">Pagado</th>
                  <th className="p-3 font-medium">Premium hasta</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{p.userName}</p>
                      <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                    </td>
                    <td className="p-3 text-foreground">{formatMoney(p.amountCents, p.currency)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{date(p.createdAt)}</td>
                    <td className="p-3 text-muted-foreground">{date(p.paidAt)}</td>
                    <td className="p-3 text-muted-foreground">{date(p.periodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
