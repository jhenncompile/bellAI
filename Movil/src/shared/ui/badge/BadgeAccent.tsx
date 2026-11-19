import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeAccentProps = BadgeBaseProps;

export const BadgeAccent: React.FC<BadgeAccentProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.state.warningBg}
      borderColor={theme.state.warning}
      textColor={theme.text.warning}
      {...props}
    />
  );
};

