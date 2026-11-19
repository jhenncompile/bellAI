import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { atelierRadii, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';

interface AtelierInputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  containerStyle?: ViewStyle;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
}

/**
 * Campo de entrada cálido y amable para formularios y barra de búsqueda.
 */
export const AtelierInput: React.FC<AtelierInputProps> = ({
  label,
  helperText,
  errorText,
  containerStyle,
  rightActionLabel,
  onRightActionPress,
  style,
  ...rest
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputBox, errorText ? styles.inputBoxError : null]}>
        <TextInput
          placeholderTextColor={atelierColors.taupe}
          style={[styles.input, style]}
          {...rest}
        />
        {rightActionLabel && onRightActionPress ? (
          <TouchableOpacity onPress={onRightActionPress} style={styles.rightBtn}>
            <Text style={styles.rightBtnText}>{rightActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.mocha,
    marginBottom: 5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.md,
    paddingHorizontal: 13,
  },
  inputBoxError: {
    borderColor: atelierColors.burgundy,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: atelierColors.espresso,
  },
  rightBtn: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  rightBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: atelierColors.terracottaDark,
  },
  helperText: {
    fontSize: 11.5,
    color: atelierColors.taupe,
    marginTop: 4,
  },
  errorText: {
    fontSize: 11.5,
    color: atelierColors.burgundy,
    fontWeight: '600',
    marginTop: 4,
  },
});
