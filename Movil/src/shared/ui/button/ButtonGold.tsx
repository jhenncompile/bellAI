import React from 'react';
import { ButtonBaseProps } from './ButtonBase';
import { ButtonPrimary } from './ButtonPrimary';

export type ButtonGoldProps = ButtonBaseProps;

/**
 * Sistema P1: el botón dorado dejó de existir como estilo propio. Se mantiene el nombre
 * para no romper pantallas y se muestra como el botón principal (tinta).
 */
export const ButtonGold: React.FC<ButtonGoldProps> = (props) => <ButtonPrimary {...props} />;
