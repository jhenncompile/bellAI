import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { typography, useTheme } from '@/shared/theme';

type TitleVariant = 'display' | 'h1' | 'titleBar' | 'h2' | 'h3' | 'stat';

export interface AccentTitleProps {
  /** Texto antes de la palabra destacada. Incluir el espacio final si hace falta. */
  prefix?: string;
  /** Palabra o frase corta en cursiva y color de acento. */
  accent: string;
  /** Texto después de la palabra destacada. */
  suffix?: string;
  variant?: TitleVariant;
  align?: 'left' | 'center';
  style?: StyleProp<TextStyle>;
  /** Color fijo del texto, para superficies que no cambian con el tema (ej. la tarjeta de resultado). */
  color?: string;
  /** Color fijo de la palabra destacada. */
  accentColor?: string;
}

/**
 * Título del rediseño: Fraunces con una palabra en cursiva y color de acento.
 * Usar una sola palabra destacada por título.
 */
export const AccentTitle: React.FC<AccentTitleProps> = ({
  prefix = '',
  accent,
  suffix = '',
  variant = 'h1',
  align = 'left',
  style,
  color,
  accentColor,
}) => {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[typography[variant], { color: color ?? colors.text.primary, textAlign: align }, style]}
    >
      {prefix}
      <Text style={[typography.emphasis, { color: accentColor ?? colors.text.accent }]}>{accent}</Text>
      {suffix}
    </Text>
  );
};
