import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTheme } from '../../theme/ThemeContext';

export interface ButtonPrimaryProps extends ButtonBaseProps {
  /** Colores opcionales para personalizar si se desea gradiente */
  gradientColors?: readonly [string, string, ...string[]];
}

export const ButtonPrimary: React.FC<ButtonPrimaryProps> = ({
  gradientColors,
  textStyle,
  style,
  ...restProps
}) => {
  const { colors: theme } = useTheme();

  if (gradientColors) {
    return (
      <ButtonBase
        {...restProps}
        loadingColor={theme.text.inverse}
        textStyle={[{ color: theme.text.inverse }, textStyle]}
        style={[styles.container, style]}
        renderBackground={(content) => (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {content}
          </LinearGradient>
        )}
      />
    );
  }

  return (
    <ButtonBase
      {...restProps}
      loadingColor={theme.text.inverse}
      textStyle={[{ color: theme.text.inverse }, textStyle]}
      style={[styles.container, { backgroundColor: theme.brand.primary }, style]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
