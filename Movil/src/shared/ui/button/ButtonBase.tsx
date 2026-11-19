import React, { useEffect, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import { useTheme, typography, spacing } from '../../theme';
import { hapticFeedback } from '../../lib/haptics';

export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonHapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'none';

export interface ButtonBaseProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Texto del botón */
  title?: string;
  /** Contenido personalizado si no se pasa `title` */
  children?: React.ReactNode;
  /** Tamaño del botón */
  size?: ButtonSize;
  /** Indica si está en estado de carga */
  loading?: boolean;
  /** Deshabilita la interacción */
  disabled?: boolean;
  /** Ícono a la izquierda del texto */
  leftIcon?: React.ReactNode;
  /** Alias para leftIcon */
  icon?: React.ReactNode;
  /** Ícono a la derecha del texto */
  rightIcon?: React.ReactNode;
  /** Tipo de vibración háptica al pulsar (default: 'light') */
  hapticType?: ButtonHapticType;
  /** Si debe ocupar el 100% del ancho del contenedor */
  fullWidth?: boolean;
  /** Habilita micro-animación de escala al presionar (default: true) */
  animatedScale?: boolean;
  /** Color personalizado para el ActivityIndicator */
  loadingColor?: string;
  /** Estilos del contenedor externo (animado) */
  style?: StyleProp<ViewStyle>;
  /** Estilos del contenido interno */
  contentStyle?: StyleProp<ViewStyle>;
  /** Estilos de la tipografía del texto */
  textStyle?: StyleProp<TextStyle>;
  /** Función para envolver el fondo (ej. LinearGradient) */
  renderBackground?: (content: React.ReactNode) => React.ReactNode;
}

export const ButtonBase: React.FC<ButtonBaseProps> = ({
  title,
  children,
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  icon,
  rightIcon,
  hapticType = 'light',
  fullWidth = false,
  animatedScale = true,
  loadingColor,
  style,
  contentStyle,
  textStyle,
  renderBackground,
  onPress,
  onPressIn,
  onPressOut,
  activeOpacity = 0.85,
  ...restProps
}) => {
  const { colors: theme, motion } = useTheme();
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const isDisabled = disabled || loading;

  const handlePressIn = (e: GestureResponderEvent) => {
    if (animatedScale && !reduceMotion && !isDisabled) {
      Animated.spring(scaleAnim, {
        toValue: motion.scales.pressedButton,
        useNativeDriver: true,
        speed: motion.springs.snappy.speed,
        bounciness: motion.springs.snappy.bounciness,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (animatedScale && !reduceMotion && !isDisabled) {
      Animated.spring(scaleAnim, {
        toValue: motion.scales.default,
        useNativeDriver: true,
        speed: motion.springs.snappy.speed,
        bounciness: motion.springs.snappy.bounciness + 2,
      }).start();
    }
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (isDisabled) return;
    if (hapticType !== 'none') {
      hapticFeedback[hapticType]();
    }
    onPress?.(e);
  };

  const innerContent = (
    <View style={[styles.innerContent, sizeContentStyles[size], contentStyle]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={loadingColor || theme.text.primary}
        />
      ) : (
        <>
          {(leftIcon || icon) && (
            <View style={styles.leftIconContainer}>{leftIcon || icon}</View>
          )}
          {title ? (
            <Text
              style={[
                typography.button,
                sizeTextStyles[size],
                { color: theme.text.primary },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            children
          )}
          {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
        </>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        animatedScale && { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.baseContainer,
          sizeContainerStyles[size],
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabledContainer,
          style,
        ]}
        {...restProps}
      >
        {renderBackground ? renderBackground(innerContent) : innerContent}
      </TouchableOpacity>
    </Animated.View>
  );
};

const sizeContainerStyles = StyleSheet.create({
  // Sistema P1: botones en píldora (radio = mitad del alto).
  sm: {
    minHeight: 44, // objetivo táctil mínimo
    borderRadius: 22,
  },
  md: {
    minHeight: 50,
    borderRadius: 25,
  },
  lg: {
    minHeight: 54,
    borderRadius: 27,
  },
});

const sizeContentStyles = StyleSheet.create({
  sm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  md: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
});

const sizeTextStyles = StyleSheet.create({
  sm: {
    fontSize: 14,
  },
  md: {
    fontSize: 15,
  },
  lg: {
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  baseContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIconContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledContainer: {
    opacity: 0.38,
  },
});
