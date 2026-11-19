import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { InputBase, InputBaseProps } from './InputBase';
import { useTheme } from '../../theme/ThemeContext';
import { typography, spacing } from '../../theme';

export interface TextAreaProps extends InputBaseProps {
  /** Altura mínima del área de texto (default: 100) */
  minHeight?: number;
  /** Muestra contador de caracteres cuando maxLength está definido */
  showCharCount?: boolean;
}

export const TextArea = forwardRef<React.ComponentRef<typeof TextInput>, TextAreaProps>(
  (
    {
      minHeight = 100,
      numberOfLines = 4,
      showCharCount = true,
      maxLength,
      value,
      inputBoxStyle,
      style,
      ...restProps
    },
    ref
  ) => {
    const { colors: theme } = useTheme();
    const currentLength = value ? value.length : 0;

    return (
      <View style={styles.container}>
        <InputBase
          ref={ref}
          value={value}
          multiline
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          inputBoxStyle={[
            styles.inputBox,
            { minHeight },
            inputBoxStyle,
          ]}
          style={[styles.input, style]}
          {...restProps}
        />
        {showCharCount && maxLength ? (
          <View style={styles.counterContainer}>
            <Text
              style={[
                typography.caption,
                styles.counterText,
                {
                  color:
                    currentLength >= maxLength
                      ? theme.status.error
                      : theme.text.muted,
                },
              ]}
            >
              {currentLength} / {maxLength}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
);

TextArea.displayName = 'TextArea';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputBox: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 2,
  },
  input: {
    textAlignVertical: 'top',
    height: '100%',
  },
  counterContainer: {
    alignItems: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    paddingRight: spacing.xs,
  },
  counterText: {
    fontSize: 11,
  },
});
