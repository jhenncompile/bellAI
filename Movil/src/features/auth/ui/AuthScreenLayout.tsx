import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import {
  Appear,
  CoralBackButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';

interface AuthScreenLayoutProps {
  children: React.ReactNode;
  /** Texto antes de la palabra destacada del título. Incluir el espacio final. */
  titlePrefix: string;
  /** Palabra del título en cursiva y color de acento. */
  titleAccent: string;
  subtitle: string;
  /** Frase que acompaña la acción secundaria, por ejemplo «¿Aún no tienes cuenta?». */
  footerPrompt: string;
  footerAction: string;
  onFooterPress?: () => void;
  onBack?: () => void;
  busy?: boolean;
  error?: string;
}

/**
 * Estructura de acceso (propuesta P1): volver, título con palabra destacada, la mascota
 * asomada sobre la tarjeta del formulario, nota de privacidad y la acción secundaria como enlace.
 */
export function AuthScreenLayout({
  children,
  titlePrefix,
  titleAccent,
  subtitle,
  footerPrompt,
  footerAction,
  onFooterPress,
  onBack,
  busy,
  error,
}: AuthScreenLayoutProps) {
  const c = useCoral();

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.topBar}>
        {onBack ? <CoralBackButton onPress={onBack} label="Volver a la bienvenida" disabled={busy} /> : <View style={styles.backSpacer} />}
      </View>

      <Appear style={styles.heading}>
        <CoralTitle prefix={titlePrefix} accent={titleAccent} size={36} />
        <Text style={[coralText.body, styles.subtitle, { color: c.ink2 }]}>{subtitle}</Text>
      </Appear>

      <View>
        <CoralCard style={styles.card}>
          {error ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.error, { backgroundColor: c.dangerBg, borderColor: c.danger }]}
            >
              <Text style={[coralText.small, { color: c.ink }]}>{error}</Text>
            </View>
          ) : null}
          {children}
          <View style={styles.note}>
            <ShieldCheck size={15} color={c.ink2} strokeWidth={2.2} />
            <Text style={[coralText.caption, { color: c.ink2 }]}>Tus datos viajan cifrados y solo tú puedes verlos.</Text>
          </View>
        </CoralCard>
        {/* La mascota se asoma por el borde superior derecho de la tarjeta. */}
        <Mascot pose="asoma" height={80} style={styles.mascot} enter="rise" delay={250} />
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={footerAction}
        accessibilityHint={footerPrompt}
        disabled={busy}
        onPress={onFooterPress}
        style={({ pressed }) => [styles.footer, pressed && { opacity: 0.6 }]}
      >
        <Text style={[coralText.body, { fontSize: 15, color: c.ink2, textAlign: 'center' }]}>
          {footerPrompt}{' '}
          <Text style={{ fontFamily: coralFonts.extrabold, color: c.ink, textDecorationLine: 'underline' }}>{footerAction}</Text>
        </Text>
      </Pressable>
    </CoralScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 8 },
  topBar: { paddingHorizontal: 4, marginBottom: 12 },
  backSpacer: { height: 44 },
  heading: { gap: 6, paddingHorizontal: 8 },
  // Deja sitio a la derecha para la mascota, que queda debajo del subtítulo.
  subtitle: { fontSize: 15, lineHeight: 21, maxWidth: '58%' },
  card: { marginTop: 36, paddingTop: 26, gap: 4 },
  mascot: { position: 'absolute', right: 18, top: -62 },
  error: { padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  footer: { minHeight: 48, justifyContent: 'center', marginTop: 18 },
});
