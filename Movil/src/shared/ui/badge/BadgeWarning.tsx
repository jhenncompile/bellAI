import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';
import { useTheme } from '../../theme/ThemeContext';

export type BadgeWarningProps = BadgeBaseProps;

export const BadgeWarning: React.FC<BadgeWarningProps> = (props) => {
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
