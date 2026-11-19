import React, { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { atelierRadii, atelierShadows, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';

interface WarmSwitchTileProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  disabled?: boolean;
}

/**
 * Interruptor cálido tipo tarjeta para la pantalla de Perfil e Historial (HU-040):
 * - Copia automática en la nube (`autoBackupEnabled`)
 * - Modo sin conexión (`offlineModeEnabled`)
 */
export const WarmSwitchTile: React.FC<WarmSwitchTileProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  return (
    <View style={styles.card}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: atelierColors.bgSand,
          true: atelierColors.terracotta,
        }}
        thumbColor={atelierColors.surfaceWhite}
      />
    </View>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.lg,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 10,
    ...atelierShadows.softCard,
  },
  textColumn: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    color: atelierColors.mocha,
    lineHeight: 16,
  },
});
