import React from 'react';
import { CardBase, CardBaseProps } from './CardBase';
import { useTheme } from '../../theme/ThemeContext';

export type CardSolidProps = CardBaseProps;

export const CardSolid: React.FC<CardSolidProps> = ({ style, ...restProps }) => {
  const { colors: theme, shadows, shapes } = useTheme();

  return (
    <CardBase
      {...restProps}
      style={[
        {
          backgroundColor: theme.background.secondary,
          borderColor: theme.border.subtle,
          borderWidth: shapes.borderWidths.thin,
          ...shadows.sm,
        },
        style,
      ]}
    />
  );
};
