import React, { forwardRef } from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { InputBase, InputBaseProps } from './InputBase';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme';
import { hapticFeedback } from '../../lib/haptics';

export interface SearchInputProps extends InputBaseProps {
  /** Estilo redondeado en forma de píldora (default: true) */
  pill?: boolean;
  /** Callback al limpiar la búsqueda */
  onClear?: () => void;
}

export const SearchInput = forwardRef<React.ComponentRef<typeof TextInput>, SearchInputProps>(
  (
    {
      pill = true,
      onClear,
      value,
      onChangeText,
      placeholder = 'Buscar...',
      inputBoxStyle,
      ...restProps
    },
    ref
  ) => {
    const { colors: theme } = useTheme();

    const handleClear = () => {
      hapticFeedback.light();
      onChangeText?.('');
      onClear?.();
    };

    const hasText = Boolean(value && value.length > 0);

    const rightIcon = hasText ? (
      <TouchableOpacity
        onPress={handleClear}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Borrar búsqueda"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={18} color={theme.text.muted} />
      </TouchableOpacity>
    ) : null;

    return (
      <InputBase
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        returnKeyType="search"
        clearButtonMode="never"
        leftIcon={<Search size={18} color={theme.text.muted} />}
        rightIcon={rightIcon}
        inputBoxStyle={[
          pill && { borderRadius: radius.full },
          inputBoxStyle,
        ]}
        {...restProps}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
