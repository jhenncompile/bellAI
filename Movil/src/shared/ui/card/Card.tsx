import React from 'react';
import { CardBaseProps } from './CardBase';
import { CardGlass } from './CardGlass';
import { CardSolid } from './CardSolid';
import { CardElevated } from './CardElevated';
import { CardGradientBorder } from './CardGradientBorder';

export type CardVariant = 'glass' | 'solid' | 'elevated' | 'gradientBorder';

export interface CardProps extends CardBaseProps {
  variant?: CardVariant;
  /** Gradiente para cuando la variante es 'gradientBorder' */
  gradientColors?: readonly [string, string, ...string[]];
}

/**
 * Componente Card unificado y retrocompatible.
 * Para código nuevo y más declarativo, puedes usar directamente `CardGlass`,
 * `CardSolid`, `CardElevated` o `CardGradientBorder`.
 */
export const Card: React.FC<CardProps> = ({
  variant = 'glass',
  gradientColors,
  ...props
}) => {
  switch (variant) {
    case 'solid':
      return <CardSolid {...props} />;
    case 'elevated':
      return <CardElevated {...props} />;
    case 'gradientBorder':
      return <CardGradientBorder gradientColors={gradientColors} {...props} />;
    case 'glass':
    default:
      return <CardGlass {...props} />;
  }
};
