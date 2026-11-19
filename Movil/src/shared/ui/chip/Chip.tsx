import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/shared/theme/ThemeContext';
import { fonts } from '@/shared/theme/tokens/typography';
import { hapticFeedback } from '@/shared/lib/haptics';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Muestra la marca ✓ cuando está seleccionado (default: true). */
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onPress,
  icon,
  disabled = false,
  showCheck = true,
  style,
  accessibilityLabel,
}) => {
  const { colors: theme } = useTheme();

  const handlePress = () => {
    if (disabled || !onPress) return;
    hapticFeedback.light();
    onPress();
  };

  const dynamicStyles = {
    activeContainer: {
      backgroundColor: theme.brand.primary,
      borderWidth: 0,
    },
    inactiveContainer: {
      backgroundColor: theme.surface.card,
      borderWidth: 1,
      // Sistema P1: borde suave para que el chip se vea también sobre tarjetas blancas.
      borderColor: theme.border.medium,
    },
    disabledContainer: {
      backgroundColor: theme.surface.disabled,
      borderColor: 'transparent',
    },
    activeText: {
      color: theme.text.inverse,
    },
    inactiveText: {
      color: theme.text.primary,
    },
    disabledText: {
      color: theme.ink[400],
    },
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel || `${label}, ${active ? 'seleccionado' : 'no seleccionado'}`}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={handlePress}
      style={[
        styles.base,
        active ? dynamicStyles.activeContainer : dynamicStyles.inactiveContainer,
        disabled && dynamicStyles.disabledContainer,
        style,
      ]}
    >
      {active && showCheck ? (
        <View style={styles.iconContainer}>
          <Check size={16} strokeWidth={2.4} color={theme.text.inverse} />
        </View>
      ) : icon ? (
        <View style={styles.iconContainer}>{icon}</View>
      ) : null}
      <Text
        style={[
          styles.text,
          active ? dynamicStyles.activeText : dynamicStyles.inactiveText,
          disabled && dynamicStyles.disabledText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
});
