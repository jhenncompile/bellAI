import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown, CreditCard } from 'lucide-react-native';
import { Banner, ContentState, ProgressBar, useNotice } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralChip,
  CoralScreen,
  CoralTitle,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { FEATURE_TEXT, formatPlanDate, type PlanFeature } from '@/features/subscription/api/subscriptionApi';
import { useSubscription, type CheckoutOutcome } from '@/features/subscription/model/useSubscription';

const FEATURES: PlanFeature[] = ['assistant_day', 'simulations_month', 'wardrobe_items'];

const limitText = (feature: PlanFeature, limit: number | null) => {
  const t = FEATURE_TEXT[feature];
  return limit === null ? 'Sin límite' : `${limit} ${t.period}`.trim();
};

/** Plan Gratis / Premium mensual: uso actual, comparación y pago con Stripe (sandbox). */
export const PremiumScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const params = useLocalSearchParams<{ status?: string; session_id?: string }>();
  const { status, loading, paying, error, refresh, confirm, startCheckout } = useSubscription();
  const handledLink = useRef(false);

  const announce = (outcome: CheckoutOutcome) => {
    if (outcome === 'paid') notify({ kind: 'success', message: '¡Listo! Ya eres Premium.' });
    else if (outcome === 'pending') notify({ kind: 'info', message: 'Tu pago se está procesando. Te avisaremos al activarse.' });
    else notify({ kind: 'info', message: 'Pago cancelado. No se hizo ningún cobro.' });
  };

  // La app también puede abrirse con el deep link bellai://premium?status=...&session_id=...
  useEffect(() => {
    if (handledLink.current || !params.status) return;
    handledLink.current = true;
    if (params.status === 'success' && params.session_id) {
      confirm(params.session_id).then(announce).catch(() => { void refresh(); });
    } else if (params.status === 'cancel') {
      announce('cancelled');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status, params.session_id]);

  const pay = async () => {
    try {
      announce(await startCheckout());
    } catch {
      // El error ya se muestra en el aviso de la pantalla
    }
  };

  if (!status) {
    return (
      <CoralScreen contentStyle={styles.content}>
        <View style={styles.titleRow}>
          <CoralBackButton onPress={() => router.back()} />
          <CoralTitle prefix="Mi " accent="plan" size={28} style={styles.flex} />
        </View>
        <ContentState
          loading={loading}
          title={loading ? 'Cargando tu plan…' : 'No pudimos cargar tu plan'}
          description={loading ? undefined : error}
          actionLabel={loading ? undefined : 'Reintentar'}
          onAction={() => { void refresh(); }}
        />
      </CoralScreen>
    );
  }

  const premium = status.isPremium;
  const { price } = status;

  return (
    <CoralScreen contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <CoralBackButton onPress={() => router.back()} />
        <CoralTitle prefix={premium ? 'Eres ' : 'Hazte '} accent="Premium" size={28} style={styles.flex} />
      </View>

      <Appear>
        <CoralCard radius={24} style={styles.current}>
          <View style={styles.planHead}>
            <Crown size={22} color={c.accent} strokeWidth={2.2} />
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
              {premium ? 'Plan Premium' : 'Plan Gratis'}
            </Text>
            {premium ? <CoralChip label="Activo" height={28} /> : null}
          </View>
          <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>
            {premium
              ? `Vigente hasta el ${formatPlanDate(status.planExpiresAt)}. Si renuevas antes, se suman ${price.days} días más.`
              : `Más mensajes, simulaciones y un armario sin límite por ${price.label} al mes.`}
          </Text>

          {FEATURES.map((f) => {
            const u = status.usage[f];
            const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
            return (
              <View key={f} style={styles.usage}>
                <View style={styles.usageRow}>
                  <Text style={[coralText.strong, styles.flex, { color: c.ink }]}>{FEATURE_TEXT[f].title}</Text>
                  <Text style={[coralText.small, { color: c.ink2 }]}>
                    {u.limit === null ? `${u.used} · sin límite` : `${u.used} de ${u.limit} ${FEATURE_TEXT[f].period}`.trim()}
                  </Text>
                </View>
                {u.limit !== null ? <ProgressBar progress={pct} height={6} /> : null}
              </View>
            );
          })}
        </CoralCard>
      </Appear>

      <Appear delay={80} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Gratis y Premium</Text>
        <CoralCard radius={24} style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[coralText.caption, styles.colFeature, { color: c.ink2 }]}> </Text>
            <Text style={[coralText.label, styles.col, { color: c.ink2 }]}>Gratis</Text>
            <Text style={[coralText.label, styles.col, { color: c.accent }]}>Premium</Text>
          </View>
          {FEATURES.map((f) => (
            <View key={f} style={[styles.tableRow, styles.tableDivider, { borderTopColor: c.fieldStroke }]}>
              <Text style={[coralText.small, styles.colFeature, { color: c.ink }]}>{FEATURE_TEXT[f].title}</Text>
              <Text style={[coralText.small, styles.col, { color: c.ink2 }]}>{limitText(f, status.limits.free[f])}</Text>
              <Text style={[coralText.strong, styles.col, { color: c.ink }]}>{limitText(f, status.limits.premium[f])}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, styles.tableDivider, { borderTopColor: c.fieldStroke }]}>
            <Text style={[coralText.small, styles.colFeature, { color: c.ink }]}>Precio</Text>
            <Text style={[coralText.small, styles.col, { color: c.ink2 }]}>Bs 0</Text>
            <Text style={[coralText.strong, styles.col, { color: c.ink }]}>{price.label}/mes</Text>
          </View>
        </CoralCard>
      </Appear>

      {status.payments.testMode ? (
        <Banner
          kind="info"
          title="Pago de prueba"
          description="No se cobra dinero real. Paga con la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC."
        />
      ) : null}
      {!status.payments.enabled ? (
        <Banner kind="warning" title="Pagos no disponibles" description="El servidor todavía no tiene configurada la pasarela de pago." />
      ) : null}
      {error ? <Banner kind="error" title="No se pudo pagar" description={error} actionLabel="Reintentar" onAction={() => { void pay(); }} /> : null}

      <CoralButton
        title={premium ? `Renovar ${price.days} días · ${price.label}` : `Hazte Premium · ${price.label}/mes`}
        leftIcon={<CreditCard size={18} color={c.onPrimary} strokeWidth={2.2} />}
        onPress={() => { void pay(); }}
        loading={paying}
        disabled={paying || !status.payments.enabled}
        fullWidth
      />
      <View style={styles.note}>
        <Check size={16} color={c.ink2} strokeWidth={2.4} />
        <Text style={[coralText.caption, styles.flex, { color: c.ink2 }]}>
          Pago único por {price.days} días. No se renueva solo: tú decides si continúas.
        </Text>
      </View>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  current: { gap: 12 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usage: { gap: 6 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 12 },
  table: { gap: 0, paddingVertical: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  tableDivider: { borderTopWidth: 1 },
  colFeature: { flex: 1.4 },
  col: { flex: 1, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
});
