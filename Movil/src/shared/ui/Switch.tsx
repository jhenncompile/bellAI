import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import { componentSizes } from '@/shared/theme/tokens/spacing';

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Nombre accesible del interruptor (obligatorio para lectores de pantalla). */
  accessibilityLabel: string;
  disabled?: boolean;
}

const TRAVEL = componentSizes.switchWidth - componentSizes.switchThumb - 6;

/** Interruptor de 52 × 30 con perilla de 24 y área táctil de 44 de alto. */
export const Switch: React.FC<SwitchProps> = ({ value, onValueChange, accessibilityLabel, disabled }) => {
  const { colors } = useTheme();
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    position.value = withTiming(value ? 1 : 0, { duration: 200, reduceMotion: ReduceMotion.System });
  }, [value, position]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? colors.switch.trackOn : colors.switch.trackOff },
        disabled && styles.disabled,
      ]}
    >
      <View pointerEvents="none" style={styles.inner}>
        <Animated.View style={[styles.thumb, { backgroundColor: colors.switch.thumb }, thumbStyle]} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: componentSizes.switchWidth,
    height: componentSizes.switchHeight,
    borderRadius: 999,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 3,
  },
  thumb: {
    width: componentSizes.switchThumb,
    height: componentSizes.switchThumb,
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
