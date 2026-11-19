import React, { useState } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme, typography, radius, spacing } from '../../theme';
import { hapticFeedback } from '../../lib/haptics';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type CardRadius = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'hero' | 'full';

export interface CardBaseProps {
  children: React.ReactNode;
  /** Función opcional que hace la tarjeta clickeable con retroalimentación háptica y animación */
  onPress?: () => void;
  /** Deshabilita la interacción si es clickeable */
  disabled?: boolean;
  /** Relleno interno (default: 'lg') */
  padding?: CardPadding;
  /** Radio de curvatura de esquinas (default: 'lg') */
  radiusSize?: CardRadius;
  /** Tipo de háptica al pulsar (default: 'light') */
  hapticType?: 'light' | 'medium' | 'none';
  /** Estilos del contenedor */
  style?: StyleProp<ViewStyle>;
  /** Estilos del contenido interno */
  contentStyle?: StyleProp<ViewStyle>;
  /** Renderizador de fondo personalizado (ej. Gradiente) */
  renderContainer?: (content: React.ReactNode) => React.ReactNode;
  /** Accesibilidad */
  accessibilityLabel?: string;
}

export const CardBase: React.FC<CardBaseProps> = ({
  children,
  onPress,
  disabled = false,
  padding = 'lg',
  radiusSize = 'xxl', // Rediseño: radio 24 para tarjetas
  hapticType = 'light',
  style,
  contentStyle,
  renderContainer,
  accessibilityLabel,
}) => {

  const { motion } = useTheme();
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const isPressable = Boolean(onPress);

  const handlePressIn = () => {
    if (isPressable && !disabled) {
      Animated.spring(scaleAnim, {
        toValue: motion.scales.pressedCard,
        useNativeDriver: true,
        speed: motion.springs.snappy.speed,
        bounciness: motion.springs.snappy.bounciness,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (isPressable && !disabled) {
      Animated.spring(scaleAnim, {
        toValue: motion.scales.default,
        useNativeDriver: true,
        speed: motion.springs.snappy.speed,
        bounciness: motion.springs.snappy.bounciness + 2,
      }).start();
    }
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    if (hapticType !== 'none') {
      hapticFeedback[hapticType]();
    }
    onPress();
  };

  const borderRadius = radius[radiusSize] || radius.lg;

  const innerContent = (
    <View style={[paddingStyles[padding], contentStyle]}>
      {children}
    </View>
  );

  const cardNode = renderContainer ? renderContainer(innerContent) : innerContent;

  if (isPressable) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, disabled && styles.disabled]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={[styles.base, { borderRadius }, style]}
        >
          {cardNode}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.base, { borderRadius }, style]}>
      {cardNode}
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/* Subcomponentes de apoyo para maquetación modular dentro de Cards            */
/* -------------------------------------------------------------------------- */

export interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const { colors: theme } = useTheme();

  if (children) {
    return <View style={[styles.header, style]}>{children}</View>;
  }

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerTextContainer}>
        {title && (
          <Text style={[typography.h3, { color: theme.text.primary }, titleStyle]}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={[typography.bodySmall, { color: theme.text.secondary, marginTop: 2 }, subtitleStyle]}>
            {subtitle}
          </Text>
        )}
      </View>
      {action && <View style={styles.headerAction}>{action}</View>}
    </View>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const CardContent: React.FC<CardContentProps> = ({ children, style }) => {
  return <View style={[styles.content, style]}>{children}</View>;
};

export interface CardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  style,
  bordered = false,
}) => {
  const { colors: theme } = useTheme();

  return (
    <View
      style={[
        styles.footer,
        bordered && {
          borderTopWidth: 1,
          borderTopColor: theme.border.subtle,
          paddingTop: spacing.md,
          marginTop: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const paddingStyles = StyleSheet.create({
  none: { padding: 0 },
  sm: { padding: spacing.sm },
  md: { padding: spacing.md },
  lg: { padding: spacing.lg },
  xl: { padding: spacing.xl },
});

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerAction: {
    marginLeft: spacing.sm,
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
});
