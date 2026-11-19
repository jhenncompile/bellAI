import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeNeutralProps = BadgeBaseProps;

export const BadgeNeutral: React.FC<BadgeNeutralProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.background.surfaceElevated}
      borderColor={theme.border.subtle}
      textColor={theme.text.secondary}
      {...props}
    />
  );
};
