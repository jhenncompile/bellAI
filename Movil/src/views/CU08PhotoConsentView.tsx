import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { Ban, ShieldCheck, UserRound } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralIconBox,
  CoralLink,
  CoralTitle,
  Mascot,
  coralText,
  useCoral,
} from '@/shared/ui/coral';

interface CU08PhotoConsentViewProps {
  onBack?: () => void;
  onGrantConsent?: () => void;
  onDenyConsent?: () => void;
  submitting?: boolean;
  errorMessage?: string;
}

const PROMISES: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: UserRound, title: 'Solo para tu diagnóstico', text: 'Tus fotos se usan únicamente para analizar tu imagen.' },
  { Icon: ShieldCheck, title: 'Lo revocas cuando quieras', text: 'Desde Perfil · Privacidad y datos.' },
  { Icon: Ban, title: 'Sin permiso, no analizamos', text: 'Si no autorizas, ninguna foto se procesa.' },
];

/** Permiso de fotos (Penpot «Flujo 02 · Análisis (P1)», A1). CU08 · HU-06 / HU-029. */
export const CU08PhotoConsentView: React.FC<CU08PhotoConsentViewProps> = ({
  onBack,
  onGrantConsent,
  onDenyConsent,
  submitting = false,
  errorMessage = '',
}) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: c.background[0] }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.top}>{onBack ? <CoralBackButton label="Volver" onPress={() => { hapticFeedback.light(); onBack(); }} disabled={submitting} /> : null}</View>
        <Mascot pose="privacidad" height={170} enter="pop" float style={styles.mascot} />
        <CoralTitle prefix="Tus fotos, " accent="solo tuyas" size={30} />
        <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>
          Para darte un diagnóstico necesitamos tu permiso para analizar las fotos de tu rostro y de tu cuerpo.
        </Text>
        <CoralCard radius={24} style={styles.card}>
          {PROMISES.map(({ Icon, title, text }, i) => (
            <View key={title} style={styles.row}>
              <CoralIconBox gradient={c.tiles[i]}><Icon size={22} color="#2A1714" strokeWidth={2.2} /></CoralIconBox>
              <View style={styles.flex}>
                <Text style={[coralText.strong, { color: c.ink }]}>{title}</Text>
                <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{text}</Text>
              </View>
            </View>
          ))}
        </CoralCard>
        {errorMessage ? (
          <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.dangerBg, borderColor: c.danger }]}>
            <Text style={[coralText.small, { color: c.ink }]}>{errorMessage}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <CoralButton
            title="Permitir y continuar"
            onPress={() => { hapticFeedback.medium(); onGrantConsent?.(); }}
            loading={submitting}
            accessibilityLabel="Autorizar el análisis de fotografías para el diagnóstico"
            fullWidth
          />
          <CoralLink title="Ahora no" underline onPress={onDenyConsent} disabled={submitting} accessibilityHint="Podrás activarlo más tarde en Privacidad y datos" />
          <Text style={[coralText.caption, styles.center, { color: c.ink2 }]}>Podrás activarlo más tarde en Privacidad y datos.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { minHeight: 44 },
  mascot: { alignSelf: 'center' },
  card: { gap: 16, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  error: { padding: 12, borderRadius: 16, borderWidth: 1 },
  actions: { marginTop: 'auto', paddingTop: 12, gap: 4, alignItems: 'center' },
});
