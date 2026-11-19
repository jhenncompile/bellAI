import React from 'react';
import { StyleSheet } from 'react-native';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTheme } from '../../theme/ThemeContext';

export type ButtonGhostProps = ButtonBaseProps;

export const ButtonGhost: React.FC<ButtonGhostProps> = ({
  textStyle,
  style,
  ...restProps
}) => {
  const { colors: theme } = useTheme();

  return (
    <ButtonBase
      {...restProps}
      loadingColor={theme.text.primary}
      // Sistema P1, decisión 1: los enlaces van en tinta y subrayados.
      textStyle={[{ color: theme.text.primary, textDecorationLine: 'underline' }, textStyle]}
      style={[styles.container, style]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
