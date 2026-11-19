import { apiClient } from '@/shared/api/apiClient';

export type PlanCode = 'free' | 'premium';
export type PlanFeature = 'assistant_day' | 'simulations_month' | 'wardrobe_items';

export interface FeatureUsage {
  used: number;
  /** null = sin límite. */
  limit: number | null;
}

export interface SubscriptionStatus {
  plan: PlanCode;
  isPremium: boolean;
  /** ISO. Solo con Premium vigente. */
  planExpiresAt: string | null;
  price: { amountCents: number; currency: string; days: number; label: string };
  limits: Record<PlanCode, Record<PlanFeature, number | null>>;
  usage: Record<PlanFeature, FeatureUsage>;
  payments: { enabled: boolean; testMode: boolean };
}

export interface CheckoutSession {
  paymentId: string;
  sessionId: string;
  url: string;
  testMode: boolean;
}

/** Plan Gratis / Premium mensual (Bs 49 · 30 días). El pago se hace en Stripe Checkout. */
export const subscriptionApi = {
  me: async () => (await apiClient.get<SubscriptionStatus>('/subscriptions/me')).data,
  checkout: async (returnUrl: string) => (await apiClient.post<CheckoutSession>('/subscriptions/checkout', { returnUrl })).data,
  confirm: async (sessionId: string) =>
    (await apiClient.post<{ paymentStatus: 'pending' | 'paid' | 'failed' | 'expired'; subscription: SubscriptionStatus }>('/subscriptions/confirm', { sessionId })).data,
};

export const FEATURE_TEXT: Record<PlanFeature, { title: string; unit: string; period: string }> = {
  assistant_day: { title: 'Mensajes a tu asesora', unit: 'mensajes', period: 'al día' },
  simulations_month: { title: 'Simulaciones', unit: 'simulaciones', period: 'al mes' },
  wardrobe_items: { title: 'Prendas en tu armario', unit: 'prendas', period: '' },
};

/** «18 de diciembre de 2026». */
export const formatPlanDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
