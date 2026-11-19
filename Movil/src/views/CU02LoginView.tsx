import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { InputText, PasswordInput } from '@/shared/ui';
import { CoralButton, CoralLink, coralText, useCoral, useCoralFieldStyles } from '@/shared/ui/coral';
import { AuthScreenLayout } from '@/features/auth/ui/AuthScreenLayout';

interface CU02LoginViewProps {
  onBack?: () => void;
  onLoginSuccess?: () => void;
  onLoginSubmit?: (email: string, password?: string) => void | Promise<void>;
  onForgotPassword?: () => void;
  onGoToRegister?: () => void;
  isSubmitting?: boolean;
  errorMessage?: string;
}

export const CU02LoginView: React.FC<CU02LoginViewProps> = ({
  onBack, onLoginSuccess, onLoginSubmit, onForgotPassword, onGoToRegister,
  isSubmitting = false, errorMessage,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = validEmail && password.length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (onLoginSubmit) void onLoginSubmit(email.trim(), password);
    else onLoginSuccess?.();
  };

  return (
    <AuthScreenLayout
      titlePrefix="Qué bueno "
      titleAccent="verte"
      subtitle="Entra para seguir con tu análisis y tu armario."
      onBack={onBack}
      footerPrompt="¿Aún no tienes una cuenta?"
      footerAction="Crear una cuenta"
      onFooterPress={onGoToRegister}
      busy={isSubmitting}
      error={errorMessage}
    >
      <View style={styles.fields}>
        <InputText
          label="Correo electrónico"
          accessibilityLabel="Correo electrónico"
          placeholder="nombre@correo.com"
          {...field}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          leftIcon={<Mail size={18} color={iconColor} />}
          containerStyle={styles.field}
        />
        {emailTouched && !validEmail ? (
          <Text accessibilityLiveRegion="polite" style={[coralText.caption, styles.validation, { color: c.ink2 }]}>Escribe un correo válido, como nombre@correo.com.</Text>
        ) : null}
        <PasswordInput
          ref={passwordRef}
          label="Contraseña"
          accessibilityLabel="Contraseña"
          placeholder="Tu contraseña"
          {...field}
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          editable={!isSubmitting}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          containerStyle={styles.field}
        />
      </View>
      <CoralLink
        title="¿Olvidaste tu contraseña?"
        accessibilityLabel="Recuperar contraseña"
        onPress={onForgotPassword}
        disabled={isSubmitting}
        underline
        style={styles.recovery}
      />
      <CoralButton
        title={isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!canSubmit}
        accessibilityLabel={isSubmitting ? 'Iniciando sesión' : 'Iniciar sesión en BellAI'}
        fullWidth
      />
    </AuthScreenLayout>
  );
};

const styles = StyleSheet.create({
  fields: { gap: 16 },
  field: { marginBottom: 0 },
  validation: { marginTop: -8 },
  recovery: { alignSelf: 'flex-end', marginVertical: 4, paddingHorizontal: 0 },
});
