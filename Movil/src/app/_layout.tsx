import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider as AuraThemeProvider, useTheme } from '@/shared/theme/ThemeContext';
import { fontAssets } from '@/shared/theme/fonts';
import { AuthProvider, useAuth } from '@/features/auth/model/AuthContext';
import { AuthFlowGateway } from '@/features/auth/ui/AuthFlowGateway';
import { NoticeProvider } from '@/shared/ui/Notice';
import { useNotifications } from '@/features/notifications';
import { PlanLimitGate } from '@/features/subscription/model/PlanLimitGate';

function InnerLayout() {
  const { isDark, colors: theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  useNotifications(isAuthenticated && !isLoading);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background.primary }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.brand.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AuthFlowGateway />
      </>
    );
  }

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PlanLimitGate />
      {/* Pestañas en (tabs); pantallas secundarias apiladas encima */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background.primary } }} />
    </NavThemeProvider>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Si las fuentes fallan, la app sigue con la fuente del sistema en lugar de bloquearse.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuraThemeProvider>
      <AuthProvider>
        <NoticeProvider>
          <InnerLayout />
        </NoticeProvider>
      </AuthProvider>
    </AuraThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
