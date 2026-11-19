import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '@/shared/theme';

interface AuraGaugeProps {
  score: number;
  tierLabel?: string;
  size?: number;
}

export const AuraGauge: React.FC<AuraGaugeProps> = ({
  score,
  tierLabel,
  size = 180,
}) => {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Halo de luz exterior */}
      <LinearGradient
        colors={['rgba(236,72,153,0.35)', 'rgba(168,85,247,0.25)', 'transparent']}
        style={[styles.glowRing, { borderRadius: size / 2 }]}
      />

      {/* Anillo de borde gradiente */}
      <LinearGradient
        colors={colors.gradients.auraGlow}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.outerBorder, { borderRadius: size / 2 }]}
      >
        {/* Centro oscuro obsidian */}
        <View style={[styles.innerCircle, { borderRadius: (size - 12) / 2 }]}>
          <Text style={[typography.caption, styles.brandLabel]}>GUÍA DE ESTILO</Text>
          <Text style={[typography.scoreBig, styles.scoreText]}>{score}</Text>
          <Text style={[typography.caption, styles.outOfText]}>DE 100</Text>
          {tierLabel && (
            <Text style={[typography.bodySmall, styles.tierText]}>{tierLabel}</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 12,
  },
  glowRing: {
    ...StyleSheet.absoluteFill,
    transform: [{ scale: 1.15 }],
  },
  outerBorder: {
    width: '100%',
    height: '100%',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  innerCircle: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLabel: {
    color: colors.brand.primaryLight,
    letterSpacing: 1.5,
  },
  scoreText: {
    color: colors.text.primary,
    marginTop: -2,
    marginBottom: -4,
  },
  outOfText: {
    color: colors.text.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
  tierText: {
    color: colors.brand.accent,
    fontWeight: '600',
    marginTop: 4,
    fontSize: 11,
  },
});
