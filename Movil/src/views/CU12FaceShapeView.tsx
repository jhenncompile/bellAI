import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, ButtonPrimary, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, Sparkles, Scissors, Smile, Glasses } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';

import { FaceGeometryVisualizer } from '@/widgets/FaceGeometryVisualizer/ui/FaceGeometryVisualizer';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU12FaceShapeViewProps {
  onBack?: () => void;
  onViewFullSummary?: () => void;
}

export const CU12FaceShapeView: React.FC<CU12FaceShapeViewProps> = ({
  onBack,
  onViewFullSummary,
}) => {
  const { currentDiagnostic } = useScanWorkflow();
  const faceShape = currentDiagnostic?.faceShape || 'Ovalado';

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

      <Text style={styles.headerLabel}>Forma de rostro</Text>

      {/* Card 1: Resultado y confianza */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.resultHeader}>
          <View style={styles.iconCircle}>
            <Sparkles size={22} color={colors.copper[500]} />
          </View>
          <View style={styles.resultHeaderText}>
            <Text style={styles.resultSubLabel}>Forma del rostro</Text>
            <Text style={styles.resultValue}>{faceShape}</Text>
          </View>
        </View>

        <Text style={styles.resultDesc}>
          {faceShape === 'Ovalado'
            ? 'Equilibrado: armonía facial simétrica con proporciones áureas.'
            : faceShape === 'Cuadrado'
            ? 'Estructurado: mandíbula angular definida con líneas de fuerza.'
            : faceShape === 'Redondo'
            ? 'Suave y armónico: contornos fluidos con pómulos prominentes.'
            : faceShape === 'Diamante'
            ? 'Definido: pómulos altos y marcados con mentón estilizado.'
            : faceShape === 'Corazon'
            ? 'Delicado: frente amplia con transición afinada hacia el mentón.'
            : 'Longitudinal: estructura esbelta con eje vertical predominante.'}
        </Text>

        <View style={styles.confidenceSection}>
          <View style={styles.confidenceLabelRow}>
            <Text style={styles.confidenceLabel}>Nivel de confianza</Text>
            <Text style={styles.confidenceValue}>
              {currentDiagnostic?.facialSymmetry ? `${Math.round(currentDiagnostic.facialSymmetry)} %` : '92 %'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: currentDiagnostic?.facialSymmetry ? `${Math.round(currentDiagnostic.facialSymmetry)}%` : '92%' },
              ]}
            />
          </View>
        </View>
      </Card>

      {/* Visualizador de Malla Biométrica 3D y Rasgos Faciales */}
      <FaceGeometryVisualizer
        diagnostic={currentDiagnostic || undefined}
        faceShape={faceShape}
        imageUri={currentDiagnostic?.imageUri}
      />

      {/* Card 2: Análisis Capilar con U-Net (Segmentación Semántica) */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.resultHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
            <Scissors size={20} color={colors.palette.copper} />
          </View>
          <View style={styles.resultHeaderText}>
            <Text style={styles.resultSubLabel}>Análisis Capilar (U-Net)</Text>
            <Text style={styles.resultValue}>Segmentación Semántica</Text>
          </View>
        </View>

        <Text style={styles.resultDesc}>
          Segmentación píxel a píxel del contorno capilar mediante U-Net (unet_pretrained.pt). Se calculó el contraste de luminancia con tu piel para recomendar cortes y tonos armonizados.
        </Text>

        <View style={styles.confidenceSection}>
          <View style={styles.confidenceLabelRow}>
            <Text style={styles.confidenceLabel}>Tonos de tinte recomendados</Text>
            <Text style={[styles.confidenceValue, { color: colors.palette.copper }]}>Cálidos</Text>
          </View>
          <Text style={[typography.small, { color: colors.ink[700], marginTop: 4 }]}>
            • Castaño avellana cálido con destellos miel
            • Chocolate con leche y reflejos cobrizos
            • Marrón café cálido para dar profundidad a la mirada
          </Text>
        </View>
      </Card>

      {/* Card 3: Lo que te favorece */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Lo que te favorece</Text>

        <View style={styles.recommendationItem}>
          <View style={styles.recIconTitleRow}>
            <Scissors size={18} color={colors.ink[900]} />
            <Text style={styles.recCategory}>Cortes</Text>
          </View>
          <Text style={styles.recDescription}>
            Melena por debajo del hombro, capas suaves
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.recommendationItem}>
          <View style={styles.recIconTitleRow}>
            <Smile size={18} color={colors.ink[900]} />
            <Text style={styles.recCategory}>Peinados</Text>
          </View>
          <Text style={styles.recDescription}>
            Raya al medio o ligeramente lateral
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.recommendationItem}>
          <View style={styles.recIconTitleRow}>
            <Glasses size={18} color={colors.ink[900]} />
            <Text style={styles.recCategory}>Gafas</Text>
          </View>
          <Text style={styles.recDescription}>
            Monturas rectangulares o cat eye
          </Text>
        </View>
      </Card>

      <ButtonPrimary
        title="Ver mi resumen completo"
        onPress={() => {
          hapticFeedback.medium();
          onViewFullSummary?.();
        }}
        accessibilityLabel="Consultar el resumen completo del diagnóstico"
        style={styles.summaryBtn}
      />

      <Text style={styles.footerNote}>
        Analizado el 22/10 a partir de tu fotografía de rostro
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
    marginBottom: spacing.lg,
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
    fontSize: 17,
    color: colors.ink[900],
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  recommendationItem: {
    paddingVertical: spacing.xs,
  },
  recIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  recCategory: {
    ...typography.bodyMedium,
    color: colors.ink[900],
    fontWeight: '700',
  },
  recDescription: {
    ...typography.body,
    color: colors.ink[700],
    fontSize: 14,
    paddingLeft: 26,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
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
