import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { componentShapes } from '@/shared/theme/tokens/shapes';

export interface ArchProps {
  width: number;
  height: number;
  /** Color liso. Se ignora si se pasa `gradient`. */
  color?: string;
  /** Degradado de 170° de arriba a abajo. */
  gradient?: readonly [string, string, ...string[]];
  /** Radio de las esquinas inferiores (default: 18). */
  bottomRadius?: number;
  /** Borde punteado para estados vacíos. */
  dashedColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Arco del rediseño: esquinas superiores completamente redondeadas y las inferiores pequeñas.
 * Decorativo por defecto; el contenido accesible va en el contenedor que lo usa.
 */
export const Arch: React.FC<ArchProps> = ({
  width,
  height,
  color,
  gradient,
  bottomRadius = componentShapes.arch.bottom,
  dashedColor,
  children,
  style,
}) => {
  const radii = {
    borderTopLeftRadius: width / 2,
    borderTopRightRadius: width / 2,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };
  const frame: ViewStyle = {
    width,
    height,
    overflow: 'hidden',
    ...radii,
    ...(dashedColor ? { borderWidth: 2, borderStyle: 'dashed', borderColor: dashedColor } : null),
  };

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={[frame, styles.center, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[frame, styles.center, { backgroundColor: color }, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
