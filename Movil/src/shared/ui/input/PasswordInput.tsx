import React, { forwardRef, useState } from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { InputBase, InputBaseProps } from './InputBase';
import { useTheme } from '../../theme/ThemeContext';
import { hapticFeedback } from '../../lib/haptics';

export type PasswordInputProps = Omit<InputBaseProps, 'secureTextEntry'>;

export const PasswordInput = forwardRef<React.ComponentRef<typeof TextInput>, PasswordInputProps>(
  ({ rightIcon, editable = true, disabled = false, ...restProps }, ref) => {
    const { colors: theme } = useTheme();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const toggleVisibility = () => {
      hapticFeedback.light();
      setIsPasswordVisible((prev) => !prev);
    };

    const eyeIcon = (
      <TouchableOpacity
        onPress={toggleVisibility}
        disabled={disabled || !editable}
        accessibilityState={{ disabled: disabled || !editable }}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isPasswordVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isPasswordVisible ? (
          <EyeOff size={20} color={theme.text.secondary} />
        ) : (
          <Eye size={20} color={theme.text.secondary} />
        )}
      </TouchableOpacity>
    );

    return (
      <InputBase
        ref={ref}
        editable={editable}
        disabled={disabled}
        secureTextEntry={!isPasswordVisible}
        autoCapitalize="none"
        autoCorrect={false}
        rightIcon={eyeIcon}
        {...restProps}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
