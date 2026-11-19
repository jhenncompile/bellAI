import React from 'react';
import {
  ScrollView,
  StyleSheet,
  StatusBar,
  ViewStyle,
  RefreshControl,
  View,
  Platform,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { componentSizes } from '../theme/tokens/spacing';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  /** Deja espacio inferior para la barra de pestañas flotante (default: true). */
  withTabBar?: boolean;
  /** Dibuja los dos halos decorativos del fondo (default: true). */
  halos?: boolean;
}

/**
 * Halos decorativos rosa y ocre del rediseño. Usan el filtro `blur` de React Native,
 * disponible en Android 12 (API 31) o superior; en versiones anteriores se omiten
 * para no dibujar círculos de borde duro.
 */
const canBlurHalos = Platform.OS !== 'android' || Number(Platform.Version) >= 31;

const Halos: React.FC = () => {
  const { colors } = useTheme();
  if (!canBlurHalos) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      <View
        style={[
          styles.halo,
          { width: 260, height: 260, left: -90, top: 90, backgroundColor: colors.background.halos[0] },
        ]}
      />
      <View
        style={[
          styles.halo,
          { width: 230, height: 230, right: -80, top: 430, backgroundColor: colors.background.halos[1] },
        ]}
      />
    </View>
  );
};

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  withTabBar = true,
  halos = true,
}) => {
  const insets = useSafeAreaInsets();
  const { colors: theme, isDark } = useTheme();

  const gradientColors = theme.gradients.auraGlow;

  const topPadding = Math.max(insets.top, StatusBar.currentHeight || 0) + 8;
  const bottomPadding = insets.bottom + (withTabBar ? componentSizes.tabBarClearance : 0);

  if (!scrollable) {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.container,
          {
            paddingTop: topPadding,
            paddingBottom: insets.bottom,
          },
          style,
        ]}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
        />
        {halos ? <Halos /> : null}
        <View style={[styles.container, contentContainerStyle]}>{children}</View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      {halos ? <Halos /> : null}
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.brand.primary}
              colors={[theme.brand.primary]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: 9999,
    filter: [{ blur: 48 }],
  },
});
