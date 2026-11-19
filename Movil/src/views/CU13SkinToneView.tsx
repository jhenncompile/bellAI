import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, ButtonPrimary, ButtonSecondary, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, Info } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU13SkinToneViewProps {
  onBack?: () => void;
  onRetakePhoto?: () => void;
  onViewPalette?: () => void;
}

export const CU13SkinToneView: React.FC<CU13SkinToneViewProps> = ({
  onBack,
  onRetakePhoto,
  onViewPalette,
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

      <Text style={styles.headerLabel}>Tono de piel</Text>

      {/* Card 1: Resultado y confianza */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.resultHeader}>
          <View style={styles.toneCircle} />
          <View style={styles.resultHeaderText}>
            <Text style={styles.resultSubLabel}>Tono de piel (ResNet-34)</Text>
            <Text style={styles.resultValue}>Medio cálido (Trigueño / Dorado)</Text>
          </View>
        </View>

        <View style={styles.confidenceSection}>
          <View style={styles.confidenceLabelRow}>
            <Text style={styles.confidenceLabel}>Nivel de confianza biométrica</Text>
            <Text style={styles.confidenceValue}>94 %</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '94%' }]} />
          </View>
        </View>
      </Card>

      {/* Card 2: Detalle cromático con ResNet-34 */}
      <Card variant="glass" style={styles.card}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Modelo biométrico</Text>
          <Text style={[styles.detailValue, { fontWeight: '700', color: colors.palette.copper }]}>ResNet-34 (colorimetry_v1)</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tono</Text>
          <Text style={styles.detailValue}>Medio cálido dorado</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subtono</Text>
          <Text style={styles.detailValue}>Cálido (dorado / caroteno)</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Coordenadas CIELAB</Text>
          <Text style={styles.detailValue}>L* 58.4 · a* 9.2 · b* 15.6</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Estación cromática</Text>
          <Text style={[styles.detailValue, { color: colors.copper[500], fontWeight: '800' }]}>
            Otoño Cálido (True Autumn)
          </Text>
        </View>
      </Card>

      {/* Aviso informativo de calibración de incertidumbre */}
      <View style={styles.infoNotice}>
        <Info size={16} color={colors.ink[700]} style={{ marginTop: 2 }} />
        <Text style={styles.infoNoticeText}>
          Si la iluminación no permite un resultado confiable, te pediremos una
          fotografía nueva.
        </Text>
      </View>

      <View style={styles.buttonStack}>
        <ButtonPrimary
          title="Ver mi paleta de colores"
          onPress={() => {
            hapticFeedback.medium();
            onViewPalette?.();
          }}
          accessibilityLabel="Consultar mi paleta personal de colores recomendados"
          style={styles.actionBtn}
        />
        <ButtonSecondary
          title="Repetir con otra foto"
          onPress={onRetakePhoto}
          accessibilityLabel="Repetir análisis de tono con otra fotografía"
          style={styles.actionBtn}
        />
      </View>

      <Text style={styles.footerNote}>
        Analizado el 22/10 · se conserva en tu perfil
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
    marginBottom: spacing.lg,
  },
  toneCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.palette.skinWarm,
    borderWidth: 2,
    borderColor: colors.border.white,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.ink[700],
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.ink[900],
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface.card,
    padding: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.lg,
  },
  infoNoticeText: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
  footerNote: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
