import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ButtonHapticType, ButtonSize } from './ButtonBase';
import { ButtonPrimary } from './ButtonPrimary';
import { ButtonSecondary } from './ButtonSecondary';
import { ButtonOutline } from './ButtonOutline';
import { ButtonGhost } from './ButtonGhost';
import { ButtonGold } from './ButtonGold';
import { radius } from '../../theme';

export type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold';

export interface IconButtonProps {
  /** Ícono a mostrar dentro del botón */
  icon: React.ReactNode;
  /** Función a ejecutar al presionar */
  onPress: () => void;
  /** Variante visual (default: 'secondary') */
  variant?: IconButtonVariant;
  /** Tamaño del botón (default: 'md') */
  size?: ButtonSize;
  /** Forma circular completa (default: true) o redondeada */
  circular?: boolean;
  /** Estado de carga */
  loading?: boolean;
  /** Deshabilitado */
  disabled?: boolean;
  /** Tipo de vibración háptica */
  hapticType?: ButtonHapticType;
  /** Accesibilidad */
  accessibilityLabel?: string;
  /** Estilos opcionales */
  style?: any;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'secondary',
  size = 'md',
  circular = true,
  loading = false,
  disabled = false,
  hapticType = 'light',
  accessibilityLabel,
  style,
}) => {
  const sizeDims = iconButtonSizes[size];
  const borderRadius = circular ? radius.full : radius.md;

  const sharedProps = {
    size,
    loading,
    disabled,
    hapticType,
    onPress,
    accessibilityLabel,
    style: [
      styles.base,
      {
        width: sizeDims.size,
        height: sizeDims.size,
        borderRadius,
      },
      style,
    ],
    contentStyle: styles.content,
  };

  const renderIcon = () => <View style={styles.iconWrapper}>{icon}</View>;

  switch (variant) {
    case 'primary':
      return <ButtonPrimary {...sharedProps}>{renderIcon()}</ButtonPrimary>;
    case 'outline':
      return <ButtonOutline {...sharedProps}>{renderIcon()}</ButtonOutline>;
    case 'ghost':
      return <ButtonGhost {...sharedProps}>{renderIcon()}</ButtonGhost>;
    case 'gold':
      return <ButtonGold {...sharedProps}>{renderIcon()}</ButtonGold>;
    case 'secondary':
    default:
      return <ButtonSecondary {...sharedProps}>{renderIcon()}</ButtonSecondary>;
  }
};

const iconButtonSizes = {
  sm: { size: 36 },
  md: { size: 44 },
  lg: { size: 52 },
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
