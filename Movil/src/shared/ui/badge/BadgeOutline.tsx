import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeOutlineProps = BadgeBaseProps;

export const BadgeOutline: React.FC<BadgeOutlineProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor="transparent"
      borderColor={theme.border.medium}
      textColor={theme.text.primary}
      {...props}
    />
  );
};
