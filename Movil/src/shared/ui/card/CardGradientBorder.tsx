import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardBase, CardBaseProps } from './CardBase';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme';

export interface CardGradientBorderProps extends CardBaseProps {
  /** Gradiente personalizado para el borde */
  gradientColors?: readonly [string, string, ...string[]];
  /** Grosor del borde gradiente (default: 1.5) */
  borderWidth?: number;
}

export const CardGradientBorder: React.FC<CardGradientBorderProps> = ({
  gradientColors,
  borderWidth = 1.5,
  radiusSize = 'lg',
  style,
  contentStyle,
  ...restProps
}) => {
  const { colors: theme } = useTheme();
  const currentRadius = radius[radiusSize] || radius.lg;
  const colors = gradientColors || theme.gradients.cardBorder;

  return (
    <CardBase
      {...restProps}
      padding="none"
      radiusSize={radiusSize}
      style={[styles.container, style]}
      renderContainer={(content) => (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientBorder, { borderRadius: currentRadius, padding: borderWidth }]}
        >
          <View
            style={[
              styles.innerContent,
              {
                backgroundColor: theme.background.secondary,
                borderRadius: Math.max(0, currentRadius - borderWidth),
              },
              contentStyle,
            ]}
          >
            {content}
          </View>
        </LinearGradient>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  gradientBorder: {
    width: '100%',
  },
  innerContent: {
    width: '100%',
    overflow: 'hidden',
  },
});
