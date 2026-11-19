import { useCallback, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { friendlyMessage } from '@/shared/api/http';
import { subscriptionApi, type SubscriptionStatus } from '../api/subscriptionApi';

export type CheckoutOutcome = 'paid' | 'pending' | 'cancelled';

/**
 * Estado del plan y flujo de pago: abre Stripe Checkout en el navegador del sistema y,
 * al volver (o al cerrarlo), confirma el pago con el backend. El webhook también lo confirma;
 * lo que llegue primero activa Premium y lo otro no hace nada.
 */
export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  // Se vuelve a poner en true al remontar (React monta dos veces en modo estricto)
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await subscriptionApi.me();
      if (mounted.current) setStatus(next);
      return next;
    } catch (err) {
      if (mounted.current) setError(friendlyMessage(err, 'No pudimos cargar tu plan.'));
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Carga inicial (loading ya empieza en true)
  useEffect(() => {
    subscriptionApi.me()
      .then((next) => { if (mounted.current) setStatus(next); })
      .catch((err) => { if (mounted.current) setError(friendlyMessage(err, 'No pudimos cargar tu plan.')); })
      .finally(() => { if (mounted.current) setLoading(false); });
  }, []);

  /** Confirma una sesión (también la usa la pantalla cuando la app se abre con el deep link). */
  const confirm = useCallback(async (sessionId: string): Promise<CheckoutOutcome> => {
    const res = await subscriptionApi.confirm(sessionId);
    if (mounted.current) setStatus(res.subscription);
    return res.paymentStatus === 'paid' ? 'paid' : 'pending';
  }, []);

  const startCheckout = useCallback(async (): Promise<CheckoutOutcome> => {
    setPaying(true);
    setError('');
    try {
      const returnUrl = Linking.createURL('premium');
      const session = await subscriptionApi.checkout(returnUrl);
      const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);
      if (result.type === 'success' && result.url.includes('status=cancel')) return 'cancelled';
      const outcome = await confirm(session.sessionId);
      // Cerró el navegador sin pagar
      if (outcome === 'pending' && result.type !== 'success') return 'cancelled';
      return outcome;
    } catch (err) {
      if (mounted.current) setError(friendlyMessage(err, 'No pudimos iniciar el pago. Inténtalo de nuevo.'));
      throw err;
    } finally {
      if (mounted.current) setPaying(false);
    }
  }, [confirm]);

  return { status, loading, paying, error, refresh, confirm, startCheckout };
}
