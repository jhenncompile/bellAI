import React from 'react';
import { BadgeBase, BadgeBaseProps, BadgeSize } from './BadgeBase';
import { BadgePrimary } from './BadgePrimary';
import { BadgeSecondary } from './BadgeSecondary';
import { BadgeAccent } from './BadgeAccent';
import { BadgeSuccess } from './BadgeSuccess';
import { BadgeWarning } from './BadgeWarning';
import { BadgeNeutral } from './BadgeNeutral';
import { BadgeOutline } from './BadgeOutline';
import { BadgeGold } from './BadgeGold';
import { useTheme } from '../../theme';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'neutral'
  | 'outline'
  | 'gold'
  | 'soft'
  | 'danger';

export interface BadgeProps extends BadgeBaseProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

/**
 * Componente Badge unificado y retrocompatible.
 * Para código nuevo y más explícito, puedes usar directamente `BadgePrimary`,
 * `BadgeSecondary`, `BadgeSuccess`, `BadgeAccent`, etc.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  ...props
}) => {
  const { colors: theme } = useTheme();
  switch (variant) {
    case 'soft':
      return <BadgeBase {...props} backgroundColor={theme.brand.accentSoft} textColor={theme.text.primary} />;
    case 'danger':
      return <BadgeBase {...props} backgroundColor={theme.state.dangerBg} textColor={theme.text.danger} />;
    case 'secondary':
      return <BadgeSecondary {...props} />;
    case 'accent':
      return <BadgeAccent {...props} />;
    case 'success':
      return <BadgeSuccess {...props} />;
    case 'warning':
      return <BadgeWarning {...props} />;
    case 'neutral':
      return <BadgeNeutral {...props} />;
    case 'outline':
      return <BadgeOutline {...props} />;
    case 'gold':
      return <BadgeGold {...props} />;
    case 'primary':
    default:
      return <BadgePrimary {...props} />;
  }
};
