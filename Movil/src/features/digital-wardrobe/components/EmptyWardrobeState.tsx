import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { atelierRadii, atelierShadows, atelierTypography, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';
import { AtelierButton } from './AtelierButton';
import { ms } from '@/shared/theme/tokens/responsive';

interface EmptyWardrobeStateProps {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onActionPress: () => void;
}

/**
 * Tarjeta de estado vacío del armario (HU-011):
 * Muestra un mensaje cálido que invita a la usuaria a agregar su primera prenda.
 */
export const EmptyWardrobeState: React.FC<EmptyWardrobeStateProps> = ({
  title = 'Tu armario digital está vacío',
  message = 'Toma una foto con tu cámara o elige una imagen de tu galería para registrar y clasificar tu primera prenda con acabado de estudio.',
  ctaLabel = 'Agregar mi primera prenda',
  onActionPress,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Camera size={26} color={atelierColors.terracotta} />
      </View>
      <Text style={styles.badge}>Armario Personal • Privado</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <AtelierButton
        title={ctaLabel}
        icon={<Camera size={16} color={atelierColors.surfaceWhite} />}
        onPress={onActionPress}
        style={styles.button}
      />
    </View>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  card: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.xl,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    marginTop: 14,
    ...atelierShadows.softCard,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: atelierColors.roseBlush,
    borderWidth: 1,
    borderColor: atelierColors.roseDust,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: ms(26),
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: atelierColors.terracottaDark,
    marginBottom: 6,
  },
  title: {
    fontFamily: atelierTypography.serifFamily,
    fontSize: 22,
    fontWeight: '700',
    color: atelierColors.espresso,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    color: atelierColors.mocha,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  button: {
    minWidth: 230,
  },
});
