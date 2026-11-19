import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/shared/theme';
import { componentSizes } from '@/shared/theme/tokens/spacing';

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Texto o contenido a la derecha. Toda la fila es pulsable. */
  children?: React.ReactNode;
  /** Nombre accesible; si se omite, se usa solo el estado. */
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Casilla de 26 × 26 con fila pulsable de al menos 44 de alto. */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  children,
  accessibilityLabel,
  disabled,
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          { borderColor: colors.text.primary },
          checked && { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
        ]}
      >
        {checked ? <Check size={16} strokeWidth={3} color={colors.text.inverse} /> : null}
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: componentSizes.touchMin,
    paddingVertical: 9,
  },
  box: {
    width: componentSizes.checkbox,
    height: componentSizes.checkbox,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
});
