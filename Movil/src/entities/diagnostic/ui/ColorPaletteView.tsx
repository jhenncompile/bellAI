import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ColorSwatch } from '../model/types';
import { colors, typography, radius, spacing } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';

interface ColorPaletteViewProps {
  palette: ColorSwatch[];
}

export const ColorPaletteView: React.FC<ColorPaletteViewProps> = ({ palette }) => {
  const handleCopyHex = (swatch: ColorSwatch) => {
    hapticFeedback.light();
    Alert.alert(swatch.name, `Código Hexadecimal: ${swatch.hex}`);
  };

  return (
    <View style={styles.container}>
      <Text style={[typography.h4, styles.title]}>Tu Paleta Personalizada</Text>
      <Text style={[typography.bodySmall, styles.subtitle]}>
        Toca cualquier tono para ver su código de color
      </Text>

      <View style={styles.grid}>
        {palette.map((swatch, index) => (
          <TouchableOpacity
            key={`${swatch.hex}-${index}`}
            activeOpacity={0.8}
            onPress={() => handleCopyHex(swatch)}
            style={styles.swatchItem}
          >
            <View style={[styles.swatchCircle, { backgroundColor: swatch.hex }]} />
            <Text style={[typography.bodySmall, styles.swatchName]} numberOfLines={1}>
              {swatch.name}
            </Text>
            <Text style={[typography.caption, styles.swatchHex]}>
              {swatch.hex}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  title: {
    color: colors.text.primary,
  },
  subtitle: {
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatchItem: {
    width: '22%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  swatchCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: spacing.xs,
  },
  swatchName: {
    color: colors.text.secondary,
    fontSize: 11,
    textAlign: 'center',
  },
  swatchHex: {
    color: colors.text.muted,
    fontSize: 11,
  },
});
