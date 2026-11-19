import React from 'react';
import { StyleSheet } from 'react-native';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTheme } from '../../theme/ThemeContext';

export type ButtonDangerProps = ButtonBaseProps;

/**
 * Botón de peligro según especificación Penpot DS-04.
 * Uso: Borrado, eliminación y revocación de permisos/datos.
 */
export const ButtonDanger: React.FC<ButtonDangerProps> = ({
  textStyle,
  style,
  ...restProps
}) => {
  const { colors: theme } = useTheme();

  return (
    <ButtonBase
      {...restProps}
      loadingColor={theme.text.onDanger}
      textStyle={[{ color: theme.text.onDanger }, textStyle]}
      style={[
        styles.container,
        {
          backgroundColor: theme.danger[500],
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
  },
});
