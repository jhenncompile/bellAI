import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  CU00WelcomeView,
  CU01RegisterView,
  CU02LoginView,
  CU03ForgotPasswordView,
} from '@/views';
import { useAuth } from '../model/AuthContext';
import { hapticFeedback } from '@/shared/lib/haptics';

type AuthScreen = 'welcome' | 'login' | 'register' | 'forgot';

export const AuthFlowGateway: React.FC = () => {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const { login, register } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const requestPending = useRef(false);

  const changeScreen = (next: AuthScreen) => {
    if (requestPending.current) return;
    setErrorMessage(undefined);
    setScreen(next);
  };

  const submitAuth = async (request: () => Promise<{ success: boolean }>, failureMessage: string) => {
    if (requestPending.current) return;
    requestPending.current = true;
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      const result = await request();
      if (result.success) {
        hapticFeedback.success();
      } else {
        setErrorMessage(failureMessage);
        hapticFeedback.warning();
      }
    } catch {
      setErrorMessage('No pudimos completar la solicitud. Revisa tu conexión e inténtalo de nuevo.');
      hapticFeedback.warning();
    } finally {
      requestPending.current = false;
      setIsSubmitting(false);
    }
  };

  const handleLogin = (email: string, password?: string) => submitAuth(
    () => login(email, password),
    'No pudimos iniciar sesión. Revisa tu correo, contraseña y conexión e inténtalo de nuevo.',
  );

  const handleRegister = (name: string, email: string, password?: string) => submitAuth(
    () => register(name, email, password),
    'No pudimos crear tu cuenta. Revisa tus datos y conexión. Si ya tienes una cuenta, inicia sesión.',
  );

  return (
    <View style={styles.container}>
      {screen === 'welcome' && (
        <CU00WelcomeView
          onStart={() => {
            hapticFeedback.light();
            changeScreen('register');
          }}
          onLogin={() => {
            hapticFeedback.light();
            changeScreen('login');
          }}
        />
      )}

      {screen === 'login' && (
        <CU02LoginView
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onBack={() => changeScreen('welcome')}
          onLoginSubmit={handleLogin}
          onForgotPassword={() => {
            hapticFeedback.light();
            changeScreen('forgot');
          }}
          onGoToRegister={() => {
            hapticFeedback.light();
            changeScreen('register');
          }}
        />
      )}

      {screen === 'register' && (
        <CU01RegisterView
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onBack={() => {
            hapticFeedback.light();
            changeScreen('welcome');
          }}
          onRegisterSubmit={handleRegister}
          onGoToLogin={() => {
            hapticFeedback.light();
            changeScreen('login');
          }}
        />
      )}

      {screen === 'forgot' && (
        <CU03ForgotPasswordView
          onBack={() => {
            hapticFeedback.light();
            changeScreen('login');
          }}
          onSentSuccess={() => {
            hapticFeedback.success();
            changeScreen('login');
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
