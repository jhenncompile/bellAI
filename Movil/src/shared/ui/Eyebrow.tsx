import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { typography, useTheme } from '@/shared/theme';

export interface EyebrowProps {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Color fijo, para superficies que no cambian con el tema. */
  color?: string;
}

/** Etiqueta de sección en mayúsculas pequeñas («Tu análisis», «Para hoy»). */
export const Eyebrow: React.FC<EyebrowProps> = ({ children, style, color }) => {
  const { colors } = useTheme();
  return (
    <Text style={[typography.eyebrow, { color: color ?? colors.text.secondary }, style]}>
      {children}
    </Text>
  );
};
