import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU14PersonalPaletteViewProps {
  onBack?: () => void;
}

export const CU14PersonalPaletteView: React.FC<CU14PersonalPaletteViewProps> = ({
  onBack,
}) => {
  return (
    <ScreenContainer scrollable contentContainerStyle={styles.container}>
      {onBack && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            hapticFeedback.light();
            onBack();
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={colors.ink[900]} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Mi paleta</Text>
      <Text style={styles.subtitle}>
        Otoño cálido · a partir de tu tono y subtono de piel
      </Text>

      {/* Card 1: Colores recomendados */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Colores recomendados</Text>
        <View style={styles.swatchesRow}>
          {[
            colors.palette.copper,
            colors.palette.coffee,
            colors.palette.ochre,
            colors.palette.olive,
            colors.palette.brick,
            colors.palette.terracotta,
          ].map((hex) => (
            <View
              key={hex}
              style={[styles.swatchCircle, { backgroundColor: hex }]}
            />
          ))}
        </View>
        <Text style={styles.cardDesc}>
          Terracota · café · mostaza · oliva · teja · cobre
        </Text>
      </Card>

      {/* Card 2: Neutros */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Neutros</Text>
        <View style={styles.swatchesRow}>
          {[
            colors.palette.cream,
            colors.palette.sand,
            colors.palette.taupe,
            colors.palette.charcoal,
          ].map((hex) => (
            <View
              key={hex}
              style={[styles.swatchCircle, { backgroundColor: hex }]}
            />
          ))}
        </View>
        <Text style={styles.cardDesc}>Crema · arena · topo · carbón</Text>
      </Card>

      {/* Card 3: Acentos */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Acentos</Text>
        <View style={styles.swatchesRow}>
          {[
            colors.palette.brick,
            colors.palette.amber,
            colors.palette.forestGreen,
          ].map((hex) => (
            <View
              key={hex}
              style={[styles.swatchCircle, { backgroundColor: hex }]}
            />
          ))}
        </View>
        <Text style={styles.cardDesc}>Rojo teja · ámbar · verde bosque</Text>
      </Card>

      {/* Card 4: Colores a evitar */}
      <Card variant="glass" style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.danger[500] }]}>
          Colores a evitar
        </Text>
        <View style={styles.swatchesRow}>
          {[
            colors.palette.avoidCold,
            colors.palette.avoidPink,
            colors.palette.avoidSilver,
          ].map((hex) => (
            <View
              key={hex}
              style={[styles.swatchCircle, { backgroundColor: hex }]}
            />
          ))}
        </View>
        <Text style={styles.cardDesc}>Azules fríos · fucsia · gris plata</Text>
      </Card>

      <Text style={styles.footerNote}>
        Tu paleta queda guardada: puedes consultarla cuando quieras desde tu perfil
      </Text>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: ms(34),
    color: colors.ink[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    color: colors.ink[700],
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h4,
    fontSize: 16,
    color: colors.ink[900],
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  swatchCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border.white,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
  },
  footerNote: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
