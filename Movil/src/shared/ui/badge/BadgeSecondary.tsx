import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeSecondaryProps = BadgeBaseProps;

export const BadgeSecondary: React.FC<BadgeSecondaryProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.ink[900]}
      borderColor={theme.ink[900]}
      textColor={theme.text.inverse}
      {...props}
    />
  );
};

