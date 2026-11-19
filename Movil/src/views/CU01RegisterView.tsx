import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Mail, UserRound } from 'lucide-react-native';
import { Checkbox, InputText, PasswordInput } from '@/shared/ui';
import { CoralButton, coralText, useCoral, useCoralFieldStyles } from '@/shared/ui/coral';
import { AuthScreenLayout } from '@/features/auth/ui/AuthScreenLayout';
import { hapticFeedback } from '@/shared/lib/haptics';

interface CU01RegisterViewProps {
  onBack?: () => void;
  onRegisterSuccess?: () => void;
  onRegisterSubmit?: (name: string, email: string, password?: string) => void | Promise<void>;
  onGoToLogin?: () => void;
  isSubmitting?: boolean;
  errorMessage?: string;
}

export const CU01RegisterView: React.FC<CU01RegisterViewProps> = ({
  onBack, onRegisterSuccess, onRegisterSubmit, onGoToLogin,
  isSubmitting = false, errorMessage,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const emailRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = Boolean(name.trim()) && validEmail && password.length >= 6 && acceptedTerms && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (onRegisterSubmit) void onRegisterSubmit(name.trim(), email.trim(), password);
    else onRegisterSuccess?.();
  };

  return (
    <AuthScreenLayout
      titlePrefix="Crea tu "
      titleAccent="cuenta"
      subtitle="Tu información se guarda de forma segura y solo tú puedes verla."
      onBack={onBack}
      footerPrompt="¿Ya tienes una cuenta?"
      footerAction="Iniciar sesión"
      onFooterPress={onGoToLogin}
      busy={isSubmitting}
      error={errorMessage}
    >
      <View style={styles.fields}>
        <InputText
          label="Nombre completo"
          accessibilityLabel="Nombre completo"
          placeholder="¿Cómo te llamas?"
          {...field}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          editable={!isSubmitting}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          leftIcon={<UserRound size={18} color={iconColor} />}
          containerStyle={styles.field}
        />
        <InputText
          ref={emailRef}
          label="Correo electrónico"
          accessibilityLabel="Correo electrónico"
          placeholder="nombre@correo.com"
          {...field}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
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
          accessibilityLabel="Crear contraseña de al menos 6 caracteres"
          placeholder="Mínimo 6 caracteres"
          {...field}
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          editable={!isSubmitting}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          containerStyle={styles.field}
        />
      </View>

      <View style={styles.checkboxRow}>
        <Checkbox
          checked={acceptedTerms}
          onChange={(next) => {
            hapticFeedback.light();
            setAcceptedTerms(next);
          }}
          disabled={isSubmitting}
          accessibilityLabel="Acepto el tratamiento de mis datos personales"
        >
          <Text style={[coralText.small, { color: c.ink2 }]}>
            Acepto el tratamiento de mis datos personales. Las fotos tienen su propio permiso más adelante.
          </Text>
        </Checkbox>
      </View>

      <CoralButton
        title={isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!canSubmit}
        accessibilityLabel={isSubmitting ? 'Creando cuenta' : 'Crear mi cuenta en BellAI'}
        fullWidth
      />
    </AuthScreenLayout>
  );
};

const styles = StyleSheet.create({
  fields: { gap: 14 },
  field: { marginBottom: 0 },
  validation: { marginTop: -6 },
  checkboxRow: { marginVertical: 14 },
});
