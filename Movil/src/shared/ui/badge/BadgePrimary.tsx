import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgePrimaryProps = BadgeBaseProps;

export const BadgePrimary: React.FC<BadgePrimaryProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.state.copperBg}
      borderColor={theme.accent[500]}
      textColor={theme.ink[900]}
      {...props}
    />
  );
};

