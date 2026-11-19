import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/theme';
import { componentShapes } from '@/shared/theme/tokens/shapes';

/**
 * Colores de texto sobre la tarjeta de resultado. El degradado no cambia con el tema,
 * así que el texto tampoco: tinta sobre coral a durazno (6,3:1 como mínimo).
 */
export const HERO_INK = '#2A1714';
export const HERO_ACCENT = '#2A1714';
export const HERO_RING = '#FFFFFF';

export interface HeroCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Tarjeta de resultado con degradado fijo y dos arcos decorativos en la esquina. */
export const HeroCard: React.FC<HeroCardProps> = ({ children, style, accessibilityLabel }) => {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, style]}
    >
      <View pointerEvents="none" accessible={false} style={styles.outline} />
      <View pointerEvents="none" accessible={false} style={styles.fill} />
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: componentShapes.card.hero,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  outline: {
    position: 'absolute',
    right: -24,
    top: -30,
    width: 150,
    height: 210,
    borderTopLeftRadius: 75,
    borderTopRightRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  fill: {
    position: 'absolute',
    right: 20,
    top: -6,
    width: 100,
    height: 150,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
