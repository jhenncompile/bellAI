import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/shared/theme';

/**
 * HU-01 (criterio 3): motivo del rechazo dentro del formulario, junto a los campos.
 * Se anuncia a los lectores de pantalla en cuanto aparece.
 */
export const AuthFormError: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <View
      style={styles.box}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <CircleAlert size={18} color={colors.state.danger} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.state.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.small,
    color: colors.ink[900],
    flex: 1,
  },
});
