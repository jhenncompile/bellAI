import React from 'react';
import { StyleSheet } from 'react-native';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTheme } from '../../theme/ThemeContext';

export interface ButtonOutlineProps extends ButtonBaseProps {
  /** Color personalizado del borde */
  borderColor?: string;
}

export const ButtonOutline: React.FC<ButtonOutlineProps> = ({
  borderColor,
  textStyle,
  style,
  ...restProps
}) => {
  const { colors: theme } = useTheme();
  // Botón secundario del rediseño: borde y texto en el color de texto principal de cada tema.
  const activeBorderColor = borderColor || theme.text.primary;
  const textColor = theme.text.primary;

  return (
    <ButtonBase
      {...restProps}
      loadingColor={textColor}
      textStyle={[{ color: textColor }, textStyle]}
      style={[
        styles.container,
        {
          backgroundColor: theme.surface.card,
          borderColor: activeBorderColor,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
  },
});
