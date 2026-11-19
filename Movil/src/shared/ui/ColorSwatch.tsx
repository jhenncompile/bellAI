import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { typography, useTheme } from '@/shared/theme';
import { Arch } from './Arch';

export interface ColorSwatchProps {
  color: string;
  /** Nombre del color; nunca depender solo del color para comunicar. */
  label: string;
  selected?: boolean;
  /** Marca interior cuando está seleccionado: ✓ para elegir, ✕ para evitar. */
  mark?: 'check' | 'cross';
  /** Forma: círculo de 44 (selección) o arco de 56 × 72 (paleta). */
  shape?: 'circle' | 'arch';
  onPress?: () => void;
}

const CIRCLE = 44;
const INK = '#2A1714';

const readableOn = (hex: string): string => {
  const value = hex.replace('#', '');
  const channel = (i: number) => parseInt(value.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(channel(0)) + 0.7152 * lin(channel(2)) + 0.0722 * lin(channel(4));
  return luminance > 0.35 ? INK : '#FFFFFF';
};

/** Muestra de color con nombre. Es pulsable solo si recibe `onPress`. */
export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  color,
  label,
  selected = false,
  mark = 'check',
  shape = 'circle',
  onPress,
}) => {
  const { colors } = useTheme();
  const Icon = mark === 'cross' ? X : Check;
  const markColor = readableOn(color);

  const swatch =
    shape === 'arch' ? (
      <Arch width={56} height={72} color={color} style={styles.edge} />
    ) : (
      <View
        style={[
          styles.ring,
          { borderColor: selected ? colors.text.primary : 'transparent' },
        ]}
      >
        <View style={[styles.circle, styles.edge, { backgroundColor: color }]}>
          {selected ? <Icon size={18} strokeWidth={2.6} color={markColor} /> : null}
        </View>
      </View>
    );

  const content = (
    <View style={styles.item}>
      {swatch}
      <Text style={[typography.caption, { color: colors.text.primary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    gap: 4,
  },
  ring: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
  },
  circle: {
    width: CIRCLE - 6,
    height: CIRCLE - 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: {
    shadowColor: INK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
  },
});
