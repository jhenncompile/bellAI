import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { useTheme, typography, fonts, radius, spacing } from '../../theme';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputBaseProps extends TextInputProps {
  /** Etiqueta sobre el campo */
  label?: string;
  /** Marca la etiqueta como campo obligatorio con un asterisco */
  required?: boolean;
  /** Mensaje de ayuda informativo debajo del campo */
  helperText?: string;
  /** Mensaje de error (resalta el campo en rojo) */
  errorText?: string;
  /** Mensaje de éxito (resalta el campo en verde) */
  successText?: string;
  /** Elemento o ícono a la izquierda del campo */
  leftIcon?: React.ReactNode;
  /** Elemento o ícono a la derecha del campo */
  rightIcon?: React.ReactNode;
  /** Tamaño del campo */
  size?: InputSize;
  /** Deshabilita la edición */
  disabled?: boolean;
  /** Estilos del contenedor general (incluye label y helperText) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Estilos de la caja del input (borde y fondo) */
  inputBoxStyle?: StyleProp<ViewStyle>;
  /** Estilos del texto de la etiqueta */
  labelStyle?: StyleProp<TextStyle>;
  /** Elemento adicional a la derecha de la etiqueta (ej. "¿Olvidaste tu contraseña?") */
  labelRightSlot?: React.ReactNode;
}

export const InputBase = forwardRef<React.ComponentRef<typeof TextInput>, InputBaseProps>(
  (
    {
      label,
      required,
      helperText,
      errorText,
      successText,
      leftIcon,
      rightIcon,
      size = 'md',
      disabled = false,
      containerStyle,
      inputBoxStyle,
      labelStyle,
      labelRightSlot,
      style,
      placeholderTextColor,
      onFocus,
      onBlur,
      editable = true,
      ...restProps
    },
    ref
  ) => {
    const { colors: theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    const isEditable = editable && !disabled;
    const hasError = Boolean(errorText);
    const hasSuccess = Boolean(successText) && !hasError;

    const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Color del borde según el estado
    let borderColor = theme.border.medium;
    if (hasError) {
      borderColor = theme.state.danger;
    } else if (hasSuccess) {
      borderColor = theme.state.success;
    } else if (isFocused) {
      borderColor = theme.border.focus;
    }

    const defaultPlaceholderColor = theme.text.secondary;
    const inputBgColor = theme.surface.input;

    return (
      <View style={[styles.container, containerStyle]}>
        {(label || labelRightSlot) && (
          <View style={styles.labelRow}>
            {label ? (
              <Text
                style={[
                  typography.label,
                  styles.label,
                  { color: theme.text.primary },
                  hasError && { color: theme.status.error },
                  labelStyle,
                ]}
              >
                {label}
                {required ? <Text style={{ color: theme.status.error }}> *</Text> : null}
              </Text>
            ) : <View />}
            {labelRightSlot}
          </View>
        )}

        <View
          style={[
            styles.inputBox,
            sizeBoxStyles[size],
            {
              backgroundColor: inputBgColor,
              borderColor,
            },
            isFocused && styles.inputBoxFocused,
            !isEditable && styles.inputBoxDisabled,
            inputBoxStyle,
          ]}
        >
          {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            editable={isEditable}
            placeholderTextColor={placeholderTextColor || defaultPlaceholderColor}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              typography.body,
              styles.input,
              sizeInputStyles[size],
              { color: theme.text.primary },
              style,
            ]}
            {...restProps}
          />

          {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
        </View>

        {hasError ? (
          <View style={styles.errorRow} accessibilityLiveRegion="polite">
            <CircleAlert size={15} color={theme.status.error} strokeWidth={2.4} />
            <Text style={[typography.caption, styles.errorText, { color: theme.status.error, fontSize: 12.5 }]}>
              {errorText}
            </Text>
          </View>
        ) : hasSuccess ? (
          <Text style={[typography.caption, styles.feedbackText, { color: theme.status.success, fontSize: 12 }]}>
            {successText}
          </Text>
        ) : helperText ? (
          <Text style={[typography.hint, styles.feedbackText, { color: theme.text.secondary }]}>
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

InputBase.displayName = 'InputBase';

const sizeBoxStyles = StyleSheet.create({
  sm: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: spacing.sm + 2,
  },
  md: {
    minHeight: 54, // Sistema P1: alto 54, radio 18
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    minHeight: 54,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
  },
});

const sizeInputStyles = StyleSheet.create({
  sm: {
    fontSize: 13,
    paddingVertical: 6,

  },
  md: {
    fontSize: 16,
    paddingVertical: 12,
  },
  lg: {
    fontSize: 16,
    paddingVertical: 14,
  },
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  label: {
    letterSpacing: 0,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    // Fijo, nunca cambia al enfocar: en Android (Fabric) alternar overflow rehace la vista nativa,
    // el campo pierde el foco, Android lo pasa al siguiente y el ciclo se repite cada vez más rápido.
    overflow: 'visible',
  },
  // Sistema P1: foco con borde de tinta y anillo coral suave.
  inputBoxFocused: {
    borderWidth: 2,
    boxShadow: '0px 0px 0px 4px rgba(255, 111, 97, 0.25)',
  },
  inputBoxDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
  },
  leftIconWrapper: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconWrapper: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackText: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xs + 2,
    marginLeft: spacing.xs,
  },
  errorText: {
    flex: 1,
    fontWeight: '700',
  },
});
