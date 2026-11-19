import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { InputText } from '@/shared/ui';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';

interface CU03ForgotPasswordViewProps {
  onBack?: () => void;
  onSentSuccess?: () => void;
}

/** Recuperar contraseña (propuesta P1): misma estructura que el inicio de sesión. */
export const CU03ForgotPasswordView: React.FC<CU03ForgotPasswordViewProps> = ({
  onBack,
  onSentSuccess,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSend = () => {
    hapticFeedback.medium();
    setIsSent(true);
    onSentSuccess?.();
  };

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.topBar}>
        {onBack ? (
          <CoralBackButton
            label="Volver al inicio de sesión"
            onPress={() => {
              hapticFeedback.light();
              onBack();
            }}
          />
        ) : null}
      </View>

      <Appear style={styles.heading}>
        <CoralTitle prefix="Recupera tu " accent="contraseña" size={34} />
        <Text style={[coralText.body, styles.subtitle, { color: c.ink2 }]}>
          Te enviaremos un enlace para crear una contraseña nueva.
        </Text>
      </Appear>

      <View>
        <CoralCard style={styles.card}>
          <InputText
            label="Correo electrónico"
            accessibilityLabel="Correo electrónico"
            placeholder="nombre@correo.com"
            {...field}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!isSent}
            returnKeyType="send"
            onSubmitEditing={() => { if (validEmail && !isSent) handleSend(); }}
            leftIcon={<Mail size={18} color={iconColor} />}
            containerStyle={styles.field}
          />

          {!isSent ? (
            <CoralButton
              title="Enviar enlace"
              onPress={handleSend}
              disabled={!validEmail}
              accessibilityLabel="Enviar enlace de recuperación"
              fullWidth
            />
          ) : (
            <View accessibilityLiveRegion="polite" style={[styles.success, { backgroundColor: c.muted }]}>
              <View style={styles.successRow}>
                <CheckCircle2 size={20} color={c.ink} />
                <Text style={[coralText.strong, { color: c.ink }]}>Enlace enviado</Text>
              </View>
              <Text style={[coralText.small, { color: c.ink2, textAlign: 'center' }]}>Revisa {email}</Text>
              <CoralButton title="Volver a iniciar sesión" variant="secondary" onPress={onBack} fullWidth />
            </View>
          )}
        </CoralCard>
        <Mascot pose="asoma" height={80} style={styles.mascot} enter="rise" delay={250} />
      </View>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 8 },
  topBar: { paddingHorizontal: 4, marginBottom: 12, minHeight: 44 },
  heading: { gap: 6, paddingHorizontal: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, maxWidth: '62%' },
  card: { marginTop: 36, paddingTop: 26, gap: 16 },
  field: { marginBottom: 0 },
  mascot: { position: 'absolute', right: 18, top: -62 },
  success: { borderRadius: 18, padding: 16, gap: 10, alignItems: 'center' },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
