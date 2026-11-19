import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0 a 100
  height?: number;
  gradientColors?: readonly [string, string, ...string[]];
  trackColor?: string;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  gradientColors,
  trackColor,
  style,
}) => {
  const { colors: theme } = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 100);
  const activeGradient = gradientColors || theme.gradients.auraGlow;
  const activeTrackColor = trackColor || theme.border.subtle;

  return (
    <View style={[styles.track, { height, borderRadius: radius.full, backgroundColor: activeTrackColor }, style]}>
      <View style={[styles.fillWrapper, { width: `${clamped}%` }]}>
        <LinearGradient
          colors={activeGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fillWrapper: {
    height: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
});
