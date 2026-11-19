export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface AdminPayment {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  provider: string;
  paidAt: string | null;
  periodEnd: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

export interface PaymentsOverview {
  activeSubscribers: number;
  pendingPayments: number;
  monthRevenueCents: number;
  currency: string;
  testMode: boolean;
  payments: AdminPayment[];
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'Fallido',
  expired: 'Vencido',
};

/** «Bs 49» a partir de céntimos y moneda ISO. */
export function formatMoney(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'bob' ? 'Bs' : currency.toUpperCase();
  const amount = cents / 100;
  return `${symbol} ${amount.toLocaleString('es-BO', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
