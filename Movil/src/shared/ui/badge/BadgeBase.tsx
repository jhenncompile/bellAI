import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme, typography, radius, spacing } from '../../theme';

export type BadgeSize = 'sm' | 'md';

export interface BadgeBaseProps {
  /** Texto del badge */
  label?: string;
  /** Contenido alternativo si no se usa label */
  children?: React.ReactNode;
  /** Ícono a la izquierda del texto */
  icon?: React.ReactNode;
  /** Tamaño del badge */
  size?: BadgeSize;
  /** Color de fondo personalizado */
  backgroundColor?: string;
  /** Color del borde personalizado */
  borderColor?: string;
  /** Color del texto personalizado */
  textColor?: string;
  /** Estilos del contenedor */
  style?: StyleProp<ViewStyle>;
  /** Estilos de la tipografía */
  textStyle?: StyleProp<TextStyle>;
}

export const BadgeBase: React.FC<BadgeBaseProps> = ({
  label,
  children,
  icon,
  size = 'md',
  backgroundColor,
  borderColor,
  textColor,
  style,
  textStyle,
}) => {
  const { colors: theme } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        sizeBadgeStyles[size],
        {
          backgroundColor: backgroundColor || theme.brand.accentSoft,
          borderColor: borderColor || 'transparent',
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      {label ? (
        <Text
          style={[
            typography.tag,
            styles.text,
            sizeTextStyles[size],
            { color: textColor || theme.text.primary },
            textStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
};

const sizeBadgeStyles = StyleSheet.create({
  sm: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
  },
  md: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});

const sizeTextStyles = StyleSheet.create({
  sm: {
    fontSize: 11,
  },
  md: {
    fontSize: 12.5,
  },
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    letterSpacing: 0,
  },
});
