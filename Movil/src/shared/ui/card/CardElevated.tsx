import React from 'react';
import { CardBase, CardBaseProps } from './CardBase';
import { useTheme } from '../../theme/ThemeContext';

export type CardElevatedProps = CardBaseProps;

export const CardElevated: React.FC<CardElevatedProps> = ({ style, ...restProps }) => {
  const { colors: theme, isDark, shadows, shapes } = useTheme();

  return (
    <CardBase
      {...restProps}
      style={[
        {
          backgroundColor: isDark ? theme.background.tertiary : theme.surface.solid,
          borderColor: theme.border.medium,
          borderWidth: shapes.borderWidths.thin,
          ...(isDark ? shadows.glowPrimary : shadows.md),
        },
        style,
      ]}
    />
  );
};
