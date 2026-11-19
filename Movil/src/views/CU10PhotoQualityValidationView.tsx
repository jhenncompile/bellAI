import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, ButtonPrimary, ButtonSecondary, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU10PhotoQualityValidationViewProps {
  onBack?: () => void;
  onRetakePhoto?: () => void;
  onPickFromGallery?: () => void;
}

export const CU10PhotoQualityValidationView: React.FC<CU10PhotoQualityValidationViewProps> = ({
  onBack,
  onRetakePhoto,
  onPickFromGallery,
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

      <Text style={styles.title}>Revisión de la foto</Text>

      {/* Previsualización simulada de la foto capturada */}
      <View style={styles.photoPreviewContainer}>
        <View style={styles.photoDarkOverlay}>
          <Text style={styles.photoOverlayText}>Foto oscura (simulación)</Text>
        </View>
      </View>

      {/* Aviso de calidad de Penpot */}
      <View style={styles.alertNotice}>
        <View style={styles.alertIconCircle}>
          <AlertTriangle size={20} color={colors.danger[500]} />
        </View>
        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>La luz no es suficiente</Text>
          <Text style={styles.alertDesc}>
            No podemos analizarla así. Repite la foto cerca de una ventana o con
            más luz.
          </Text>
        </View>
      </View>

      {/* Tarjeta de revisión automática de 3 parámetros */}
      <Card variant="glass" style={styles.checklistCard}>
        <Text style={styles.cardTitle}>Revisión automática</Text>

        <View style={styles.checkRow}>
          <Text style={styles.checkLabel}>Iluminación</Text>
          <View style={styles.statusBadgeDanger}>
            <XCircle size={14} color={colors.danger[500]} />
            <Text style={styles.statusTextDanger}>Muy oscura</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.checkRow}>
          <Text style={styles.checkLabel}>Nitidez</Text>
          <View style={styles.statusBadgeSuccess}>
            <CheckCircle2 size={14} color={colors.olive[500]} />
            <Text style={styles.statusTextSuccess}>Correcta</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.checkRow}>
          <Text style={styles.checkLabel}>Encuadre</Text>
          <View style={styles.statusBadgeSuccess}>
            <CheckCircle2 size={14} color={colors.olive[500]} />
            <Text style={styles.statusTextSuccess}>Rostro completo</Text>
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        <ButtonPrimary
          title="Repetir foto"
          onPress={() => {
            hapticFeedback.medium();
            onRetakePhoto?.();
          }}
          accessibilityLabel="Repetir captura de fotografía con mejor luz"
          style={styles.actionBtn}
        />
        <ButtonSecondary
          title="Elegir otra de la galería"
          onPress={onPickFromGallery}
          accessibilityLabel="Seleccionar una fotografía existente de la galería"
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
  title: {
    ...typography.h1,
    fontSize: ms(32),
    color: colors.ink[900],
    marginBottom: spacing.md,
  },
  photoPreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    backgroundColor: colors.surface.camera,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photoDarkOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.hintOverlay,
  },
  photoOverlayText: {
    ...typography.caption,
    color: colors.ink[300],
    fontStyle: 'italic',
  },
  alertNotice: {
    flexDirection: 'row',
    backgroundColor: colors.state.dangerBg,
    padding: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.state.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    ...typography.h4,
    fontSize: 15,
    color: colors.danger[500],
    fontWeight: '700',
    marginBottom: 2,
  },
  alertDesc: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
    lineHeight: 18,
  },
  checklistCard: {
    padding: spacing.lg,
    borderRadius: 20,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.h4,
    fontSize: 16,
    color: colors.ink[900],
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  checkLabel: {
    ...typography.bodyMedium,
    color: colors.ink[900],
    fontWeight: '600',
  },
  statusBadgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.state.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusTextDanger: {
    ...typography.caption,
    color: colors.danger[500],
    fontWeight: '700',
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.state.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusTextSuccess: {
    ...typography.caption,
    color: colors.olive[500],
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
});
