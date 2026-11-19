import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeSuccessProps = BadgeBaseProps;

export const BadgeSuccess: React.FC<BadgeSuccessProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.state.successBg}
      borderColor={theme.state.success}
      textColor={theme.state.success}
      {...props}
    />
  );
};
