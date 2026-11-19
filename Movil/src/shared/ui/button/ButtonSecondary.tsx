import React from 'react';
import { StyleSheet } from 'react-native';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTheme } from '../../theme/ThemeContext';

export type ButtonSecondaryProps = ButtonBaseProps;

export const ButtonSecondary: React.FC<ButtonSecondaryProps> = ({
  textStyle,
  style,
  ...restProps
}) => {
  const { colors: theme } = useTheme();

  return (
    <ButtonBase
      {...restProps}
      loadingColor={theme.ink[900]}
      textStyle={[{ color: theme.ink[900] }, textStyle]}
      style={[
        styles.container,
        {
          // Sistema P1: el secundario es el mismo contorno en tinta que ButtonOutline.
          backgroundColor: theme.surface.card,
          borderColor: theme.text.primary,
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
