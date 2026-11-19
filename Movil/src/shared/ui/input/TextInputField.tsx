import React, { forwardRef } from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { InputBase, InputBaseProps } from './InputBase';
import { useTheme } from '../../theme/ThemeContext';
import { hapticFeedback } from '../../lib/haptics';

export interface TextInputFieldProps extends InputBaseProps {
  /** Muestra un botón para limpiar el texto cuando hay contenido */
  clearable?: boolean;
  /** Callback al limpiar el texto */
  onClear?: () => void;
}

export const TextInputField = forwardRef<React.ComponentRef<typeof TextInput>, TextInputFieldProps>(
  ({ clearable = false, onClear, value, onChangeText, rightIcon, ...restProps }, ref) => {
    const { colors: theme } = useTheme();

    const handleClear = () => {
      hapticFeedback.light();
      onChangeText?.('');
      onClear?.();
    };

    const showClearButton = clearable && Boolean(value && value.length > 0);

    const effectiveRightIcon = showClearButton ? (
      <TouchableOpacity
        onPress={handleClear}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Limpiar texto"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={18} color={theme.text.muted} />
      </TouchableOpacity>
    ) : (
      rightIcon
    );

    return (
      <InputBase
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        rightIcon={effectiveRightIcon}
        {...restProps}
      />
    );
  }
);

TextInputField.displayName = 'TextInputField';
