import React from 'react';
import { BadgeBase, BadgeBaseProps } from './BadgeBase';

import { useTheme } from '../../theme/ThemeContext';

export type BadgeGoldProps = BadgeBaseProps;

export const BadgeGold: React.FC<BadgeGoldProps> = (props) => {
  const { colors: theme } = useTheme();

  return (
    <BadgeBase
      backgroundColor={theme.state.warningBg}
      borderColor={theme.border.gold}
      textColor={theme.border.gold}
      {...props}
    />
  );
};
