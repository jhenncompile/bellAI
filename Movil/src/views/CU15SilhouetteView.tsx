import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, ButtonPrimary, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, User } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU15SilhouetteViewProps {
  onBack?: () => void;
  onViewSummary?: () => void;
}

export const CU15SilhouetteView: React.FC<CU15SilhouetteViewProps> = ({
  onBack,
  onViewSummary,
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

      <Text style={styles.headerLabel}>Proporciones</Text>

      {/* Card 1: Resultado silueta */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.resultHeader}>
          <View style={styles.iconCircle}>
            <User size={22} color={colors.copper[500]} />
          </View>
          <View style={styles.resultHeaderText}>
            <Text style={styles.resultSubLabel}>Estimador de Puntos Clave</Text>
            <Text style={styles.resultValue}>Reloj de Arena / Proporción Clásica</Text>
          </View>
        </View>

        <Text style={styles.resultDesc}>
          Backbone ResNet-34 (resnet34_pretrained.pt · morphology_v1) para extracción de rasgos anatómicos y cálculo de proporciones relativas.
        </Text>

        <View style={styles.confidenceSection}>
          <View style={styles.confidenceLabelRow}>
            <Text style={styles.confidenceLabel}>Nivel de confianza biométrica</Text>
            <Text style={styles.confidenceValue}>93 %</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '93%' }]} />
          </View>
        </View>
      </Card>

      {/* Card 2: Tus proporciones (Keypoints COCO) */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Puntos clave biométricos (ResNet-34)</Text>

        <View style={styles.propRow}>
          <Text style={styles.propLabel}>Hombros / Cadera (Ratio)</Text>
          <Text style={[styles.propValue, { color: colors.palette.copper, fontWeight: '700' }]}>1.02 · Alineación Simétrica</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.propRow}>
          <Text style={styles.propLabel}>Cintura / Cadera (Ratio)</Text>
          <Text style={[styles.propValue, { color: colors.palette.copper, fontWeight: '700' }]}>0.72 · Curvatura Definida</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.propRow}>
          <Text style={styles.propLabel}>Eje vertical</Text>
          <Text style={styles.propValue}>Equilibrio áureo tronco-piernas</Text>
        </View>
      </Card>

      {/* Card 3: Lo que te favorece */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Lo que te favorece</Text>

        <View style={styles.favItem}>
          <Text style={styles.favCategory}>Cortes</Text>
          <Text style={styles.favDesc}>
            Rectos y semiajustados, sin rigidez
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.favItem}>
          <Text style={styles.favCategory}>Largos</Text>
          <Text style={styles.favDesc}>
            Midi y tobillero; chaquetas a la cadera
          </Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.favItem}>
          <Text style={styles.favCategory}>Estructuras</Text>
          <Text style={styles.favDesc}>
            Telas con caída, hombros naturales
          </Text>
        </View>
      </Card>

      <ButtonPrimary
        title="Ver mi resumen completo"
        onPress={() => {
          hapticFeedback.medium();
          onViewSummary?.();
        }}
        accessibilityLabel="Consultar el resumen completo del diagnóstico de silueta"
        style={styles.summaryBtn}
      />

      <Text style={styles.footerNote}>
        Calculado a partir de tu fotografía de cuerpo completo del 22/10
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
  headerLabel: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.xl,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.state.copperBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeaderText: {
    flex: 1,
  },
  resultSubLabel: {
    ...typography.caption,
    color: colors.ink[700],
    fontSize: 13,
  },
  resultValue: {
    ...typography.h2,
    fontSize: ms(26),
    color: colors.ink[900],
    fontWeight: '700',
  },
  resultDesc: {
    ...typography.body,
    fontSize: 15,
    color: colors.ink[700],
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  confidenceSection: {
    marginTop: spacing.xs,
  },
  confidenceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  confidenceLabel: {
    ...typography.caption,
    color: colors.ink[700],
    fontSize: 12,
  },
  confidenceValue: {
    ...typography.caption,
    color: colors.ink[900],
    fontWeight: '700',
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border.subtle,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.ink[900],
    borderRadius: 999,
  },
  cardTitle: {
    ...typography.h4,
    fontSize: 16,
    color: colors.ink[900],
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  propLabel: {
    ...typography.bodyMedium,
    color: colors.ink[700],
  },
  propValue: {
    ...typography.bodyMedium,
    color: colors.ink[900],
    fontWeight: '700',
  },
  favItem: {
    paddingVertical: spacing.xs,
  },
  favCategory: {
    ...typography.bodyMedium,
    color: colors.ink[900],
    fontWeight: '700',
    marginBottom: 2,
  },
  favDesc: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  summaryBtn: {
    width: '100%',
    marginTop: spacing.xs,
  },
  footerNote: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
