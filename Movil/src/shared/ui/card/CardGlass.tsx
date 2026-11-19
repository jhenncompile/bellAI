import React from 'react';
import { CardBase, CardBaseProps } from './CardBase';
import { useTheme } from '../../theme/ThemeContext';

export type CardGlassProps = CardBaseProps;

/**
 * Sistema P1: la antigua tarjeta de vidrio es ahora la tarjeta base, blanca y sólida,
 * con una sombra cálida suave (0 10 28, ladrillo al 14 %). Se conserva el nombre
 * `glass` para no tocar las pantallas que la usan.
 */
export const CardGlass: React.FC<CardGlassProps> = ({ style, ...restProps }) => {
  const { colors: theme } = useTheme();
  return (
    <CardBase
      {...restProps}
      style={[
        {
          backgroundColor: theme.surface.card,
          boxShadow: '0px 10px 28px rgba(179, 57, 46, 0.14)',
        },
        style,
      ]}
    />
  );
};
