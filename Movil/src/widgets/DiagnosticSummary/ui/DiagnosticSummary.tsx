import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { ColorPaletteView } from '@/entities/diagnostic/ui/ColorPaletteView';
import { Card, Badge } from '@/shared/ui';
import { colors, typography, radius, spacing, useTheme } from '@/shared/theme';
import {
  Scissors,
  Glasses,
  CheckCircle2,
  XCircle,
  Gem,
} from 'lucide-react-native';

interface DiagnosticSummaryProps {
  diagnostic: DiagnosticResult;
}

export const DiagnosticSummary: React.FC<DiagnosticSummaryProps> = ({ diagnostic }) => {
  const { colors: theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Tarjeta de Atributos Clave */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[typography.h3, { color: theme.text.primary }]}>
            Diagnóstico Morfológico
          </Text>
          <Badge label={diagnostic.season} variant="primary" />
        </View>

        {/* Rejilla de métricas */}
        <View style={styles.grid}>
          <View style={[styles.gridItem, { backgroundColor: theme.surface.input }]}>
            <Text style={[typography.caption, styles.gridLabel]}>SUBTONO</Text>
            <Text style={[typography.bodyLarge, { color: theme.text.primary, fontWeight: '700' }]}>
              {diagnostic.undertone}
            </Text>
          </View>

          <View style={[styles.gridItem, { backgroundColor: theme.surface.input }]}>
            <Text style={[typography.caption, styles.gridLabel]}>FORMA DE ROSTRO</Text>
            <Text style={[typography.bodyLarge, { color: theme.text.primary, fontWeight: '700' }]}>
              {diagnostic.faceShape}
            </Text>
          </View>

          <View style={[styles.gridItem, { backgroundColor: theme.surface.input }]}>
            <Text style={[typography.caption, styles.gridLabel]}>CONTRASTE</Text>
            <Text style={[typography.bodyLarge, { color: theme.text.primary, fontWeight: '700' }]}>
              {diagnostic.contrastLevel}
            </Text>
          </View>

          <View style={[styles.gridItem, { backgroundColor: theme.surface.input }]}>
            <Text style={[typography.caption, styles.gridLabel]}>TIPO CORPORAL</Text>
            <Text style={[typography.bodyLarge, { color: theme.text.primary, fontWeight: '700' }]}>
              {diagnostic.bodyType || 'Equilibrado'}
            </Text>
          </View>
        </View>

        {/* Metales Favorables */}
        <View style={styles.metalsBox}>
          <View style={styles.metalsHeader}>
            <Gem color={colors.copper[500]} size={16} />
            <Text style={[typography.caption, styles.metalsTitle]}>
              METALES RECOMENDADOS
            </Text>
          </View>
          <View style={styles.metalsRow}>
            {diagnostic.recommendedMetals.map((metal, idx) => (
              <Badge key={idx} label={metal} variant="accent" style={styles.metalBadge} />
            ))}
          </View>
        </View>
      </Card>

      {/* Paleta de Colorimetría Interactiva */}
      <Card variant="glass" style={styles.card}>
        <ColorPaletteView palette={diagnostic.palette} />
      </Card>

      {/* Asesoría de Cabello */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.adviceHeader}>
          <Scissors color={colors.ink[900]} size={20} />
          <Text style={[typography.h4, { color: theme.text.primary }]}>
            Cortes y Coloración Capilar
          </Text>
        </View>

        <Text style={[typography.caption, styles.subHeader]}>CORTES QUE TE FAVORECEN</Text>
        <View style={styles.list}>
          {diagnostic.hairAdvice.recommendedCuts.map((cut, i) => (
            <View key={i} style={styles.listItem}>
              <CheckCircle2 color={colors.olive[500]} size={15} />
              <Text style={[typography.bodyMedium, { color: theme.text.secondary }]}>{cut}</Text>
            </View>
          ))}
        </View>

        <Text style={[typography.caption, styles.subHeader]}>TONOS RECOMENDADOS</Text>
        <View style={styles.list}>
          {diagnostic.hairAdvice.recommendedShades.map((shade, i) => (
            <View key={i} style={styles.listItem}>
              <CheckCircle2 color={colors.copper[500]} size={15} />
              <Text style={[typography.bodyMedium, { color: theme.text.secondary }]}>{shade}</Text>
            </View>
          ))}
        </View>

        <Text style={[typography.caption, styles.subHeader]}>TONOS A EVITAR</Text>
        <View style={styles.list}>
          {diagnostic.hairAdvice.avoidShades.map((avoid, i) => (
            <View key={i} style={styles.listItem}>
              <XCircle color={colors.danger[500]} size={15} />
              <Text style={[typography.bodyMedium, styles.listTextAvoid]}>{avoid}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Asesoría de Gafas / Lentes */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.adviceHeader}>
          <Glasses color={colors.ink[900]} size={20} />
          <Text style={[typography.h4, { color: theme.text.primary }]}>
            Monturas de Gafas Ideales
          </Text>
        </View>

        <Text style={[typography.caption, styles.subHeader]}>MONTURAS RECOMENDADAS</Text>
        <View style={styles.list}>
          {diagnostic.glassesAdvice.recommendedFrames.map((frame, i) => (
            <View key={i} style={styles.listItem}>
              <CheckCircle2 color={colors.olive[500]} size={15} />
              <Text style={[typography.bodyMedium, { color: theme.text.secondary }]}>{frame}</Text>
            </View>
          ))}
        </View>

        <Text style={[typography.caption, styles.subHeader]}>MONTURAS A EVITAR</Text>
        <View style={styles.list}>
          {diagnostic.glassesAdvice.avoidFrames.map((avoid, i) => (
            <View key={i} style={styles.listItem}>
              <XCircle color={colors.danger[500]} size={15} />
              <Text style={[typography.bodyMedium, styles.listTextAvoid]}>{avoid}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
    borderRadius: 20,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridItem: {
    width: '47%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  gridLabel: {
    color: colors.ink[700],
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  metalsBox: {
    backgroundColor: colors.state.copperBg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  metalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  metalsTitle: {
    color: colors.copper[600],
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  metalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metalBadge: {
    marginTop: 4,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subHeader: {
    color: colors.ink[700],
    marginTop: spacing.sm,
    marginBottom: 6,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  list: {
    gap: 6,
    marginBottom: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listTextAvoid: {
    color: colors.ink[400],
    textDecorationLine: 'line-through',
  },
});
