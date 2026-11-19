import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, ButtonPrimary, ButtonSecondary, ButtonGhost, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, AlertCircle } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU17RetryAnalysisViewProps {
  onBack?: () => void;
  onRetryAnalysis?: () => void;
  onUseAnotherPhoto?: () => void;
  onSkip?: () => void;
}

export const CU17RetryAnalysisView: React.FC<CU17RetryAnalysisViewProps> = ({
  onBack,
  onRetryAnalysis,
  onUseAnotherPhoto,
  onSkip,
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

      <Text style={styles.headerLabel}>Diagnóstico</Text>

      <View style={styles.iconCircle}>
        <AlertCircle size={36} color={colors.danger[500]} />
      </View>

      <Text style={styles.title}>No pudimos completar el análisis</Text>

      {/* Tarjeta de motivo */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Motivo</Text>
        <Text style={styles.reasonText}>
          El servicio de análisis de imagen no respondió a tiempo.
        </Text>
        <View style={styles.errorCodeTag}>
          <Text style={styles.errorCodeText}>ERR-VISION-TIMEOUT</Text>
        </View>
      </Card>

      {/* Tarjeta de qué puedes hacer */}
      <Card variant="glass" style={styles.card}>
        <Text style={styles.cardTitle}>Qué puedes hacer</Text>

        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeNumber}>1</Text>
          </View>
          <Text style={styles.stepText}>Revisa tu conexión a internet.</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>Vuelve a intentarlo en unos segundos.</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Si continúa, prueba con otra fotografía.
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <ButtonPrimary
          title="Reintentar análisis"
          onPress={() => {
            hapticFeedback.medium();
            onRetryAnalysis?.();
          }}
          accessibilityLabel="Reintentar el análisis biométrico de la fotografía"
          style={styles.actionBtn}
        />

        <ButtonSecondary
          title="Usar otra fotografía"
          onPress={onUseAnotherPhoto}
          accessibilityLabel="Tomar o seleccionar otra fotografía para reintentar"
          style={styles.actionBtn}
        />

        <ButtonGhost
          title="Omitir por ahora"
          onPress={onSkip}
          accessibilityLabel="Omitir el análisis por ahora"
          style={styles.actionBtn}
        />
      </View>
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.state.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    fontSize: ms(26),
    color: colors.ink[900],
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
    marginBottom: spacing.sm,
  },
  reasonText: {
    ...typography.body,
    color: colors.ink[700],
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  errorCodeTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.border.subtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorCodeText: {
    ...typography.caption,
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.ink[700],
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepBadgeNumber: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  stepText: {
    ...typography.body,
    fontSize: 14,
    color: colors.ink[700],
    flex: 1,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  actionBtn: {
    width: '100%',
  },
});
