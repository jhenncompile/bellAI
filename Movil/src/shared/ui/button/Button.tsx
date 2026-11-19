import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ButtonBaseProps, ButtonSize } from './ButtonBase';
import { ButtonPrimary } from './ButtonPrimary';
import { ButtonSecondary } from './ButtonSecondary';
import { ButtonOutline } from './ButtonOutline';
import { ButtonGhost } from './ButtonGhost';
import { ButtonGold } from './ButtonGold';
import { ButtonDanger } from './ButtonDanger';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger';

export interface ButtonProps extends Omit<ButtonBaseProps, 'style' | 'textStyle'> {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Componente Button unificado y retrocompatible.
 * Para mayor claridad en código nuevo, puedes usar directamente `ButtonPrimary`,
 * `ButtonSecondary`, `ButtonOutline`, `ButtonGhost`, `ButtonGold` o `ButtonDanger`.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  icon,
  leftIcon,
  ...props
}) => {
  const effectiveLeftIcon = leftIcon || icon;

  switch (variant) {
    case 'secondary':
      return <ButtonSecondary leftIcon={effectiveLeftIcon} {...props} />;
    case 'outline':
      return <ButtonOutline leftIcon={effectiveLeftIcon} {...props} />;
    case 'ghost':
      return <ButtonGhost leftIcon={effectiveLeftIcon} {...props} />;
    case 'gold':
      return <ButtonGold leftIcon={effectiveLeftIcon} {...props} />;
    case 'danger':
      return <ButtonDanger leftIcon={effectiveLeftIcon} {...props} />;
    case 'primary':
    default:
      return <ButtonPrimary leftIcon={effectiveLeftIcon} {...props} />;
  }
};

