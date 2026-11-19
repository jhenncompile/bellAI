import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AuraScoreData } from '@/entities/aura-score/model/types';
import { Card, ButtonPrimary } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { Smile, Palette, User, ChevronRight } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface AuraScoreCardProps {
  scoreData?: AuraScoreData;
  onNavigateToFace?: () => void;
  onNavigateToColor?: () => void;
  onNavigateToSilhouette?: () => void;
  onViewRecommendations?: () => void;
}

export const AuraScoreCard: React.FC<AuraScoreCardProps> = ({
  scoreData,
  onNavigateToFace,
  onNavigateToColor,
  onNavigateToSilhouette,
  onViewRecommendations,
}) => {
  const score = scoreData?.totalScore || 78;

  return (
    <View style={styles.container}>
      {/* Tarjeta de AURA Score Penpot CU-16 */}
      <Card variant="glass" style={styles.scoreCard}>
        <View style={styles.scoreGaugeRow}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>{score}</Text>
          </View>
          <View style={styles.scoreTextCol}>
            <Text style={styles.scoreTitle}>Guía de estilo</Text>
            <Text style={styles.scoreTag}>Armonía equilibrada</Text>
          </View>
        </View>

        <Text style={styles.scoreDesc}>
          Tus rasgos armonizan bien: lo que más destaca es tu colorimetría
          cálida.
        </Text>
      </Card>

      {/* Resumen 1 · Rostro */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de la forma de mi rostro"
        onPress={() => {
          hapticFeedback.light();
          onNavigateToFace?.();
        }}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconCircle}>
              <Smile size={20} color={colors.ink[900]} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.categoryLabel}>Forma del rostro</Text>
              <Text style={styles.valueLabel}>Ovalado</Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.descLabel}>
            Favorece la mayoría de cortes y monturas.
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Resumen 2 · Colorimetría */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de mi colorimetría estacional"
        onPress={() => {
          hapticFeedback.light();
          onNavigateToColor?.();
        }}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconCircle}>
              <Palette size={20} color={colors.copper[500]} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.categoryLabel}>Colorimetría estacional</Text>
              <Text style={styles.valueLabel}>Otoño cálido</Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.descLabel}>
            Subtono cálido con alta tolerancia a tierras y ocres.
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Resumen 3 · Silueta */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de mis proporciones de silueta"
        onPress={() => {
          hapticFeedback.light();
          onNavigateToSilhouette?.();
        }}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconCircle}>
              <User size={20} color={colors.olive[500]} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.categoryLabel}>Tipo de cuerpo</Text>
              <Text style={styles.valueLabel}>Natural clásico</Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.descLabel}>
            Líneas suaves con estructura equilibrada.
          </Text>
        </Card>
      </TouchableOpacity>

      <ButtonPrimary
        title="Ver recomendaciones para mí"
        onPress={() => {
          hapticFeedback.medium();
          onViewRecommendations?.();
        }}
        accessibilityLabel="Ver recomendaciones personalizadas según mi diagnóstico"
        style={styles.ctaBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  scoreCard: {
    padding: spacing.xl,
    borderRadius: 20,
    marginBottom: spacing.xs,
  },
  scoreGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  scoreCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.copper[500],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.input,
  },
  scoreNumber: {
    ...typography.h2,
    fontSize: ms(28),
    color: colors.ink[900],
    fontWeight: '800',
  },
  scoreTextCol: {
    flex: 1,
  },
  scoreTitle: {
    ...typography.h3,
    fontSize: 20,
    color: colors.ink[900],
    fontWeight: '700',
  },
  scoreTag: {
    ...typography.caption,
    color: colors.copper[600],
    fontWeight: '600',
    marginTop: 2,
  },
  scoreDesc: {
    ...typography.body,
    fontSize: 14,
    color: colors.ink[700],
    lineHeight: 20,
  },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextCol: {
    flex: 1,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.ink[700],
    fontSize: 12,
  },
  valueLabel: {
    ...typography.h4,
    fontSize: 17,
    color: colors.ink[900],
    fontWeight: '700',
  },
  descLabel: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 56,
  },
  ctaBtn: {
    width: '100%',
    marginTop: spacing.xs,
  },
});
