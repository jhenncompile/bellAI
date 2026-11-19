import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Chip, ButtonGhost } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, Sun, EyeOff, UserCheck } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';


interface CU09GuidedCameraViewProps {
  onBack?: () => void;
  onCapturePhoto?: (mode: 'face' | 'body') => void;
  onSkip?: () => void;
}

export const CU09GuidedCameraView: React.FC<CU09GuidedCameraViewProps> = ({
  onBack,
  onCapturePhoto,
  onSkip,
}) => {
  const [mode, setMode] = useState<'face' | 'body'>('face');

  return (
    <ScreenContainer scrollable={false} contentContainerStyle={styles.container}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        {onBack && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              hapticFeedback.light();
              onBack();
            }}
            style={styles.circleBtn}
          >
            <ArrowLeft size={22} color={colors.ink[900]} />
          </TouchableOpacity>
        )}

        <View style={styles.modeChips}>
          <Chip
            label="Rostro"
            active={mode === 'face'}
            onPress={() => setMode('face')}
          />
          <Chip
            label="Cuerpo completo"
            active={mode === 'body'}
            onPress={() => setMode('body')}
          />
        </View>
      </View>

      <Text style={styles.title}>Diagnóstico de imagen</Text>
      <Text style={styles.subtitle}>
        {mode === 'face'
          ? 'Apunta a tu rostro con buena luz. La IA detectará tus facciones y adaptará la malla vectorial automáticamente.'
          : 'Párate frente a la cámara mostrando tu silueta completa. Los vectores se adaptarán a tus proporciones.'}
      </Text>

      {/* Visor de cámara con encuadre limpio */}
      <View style={styles.cameraViewport}>
        <View
          style={[
            styles.guidanceFrame,
            mode === 'face' ? styles.faceOval : styles.bodyRect,
          ]}
        >
          <View style={styles.reticleCornerTL} />
          <View style={styles.reticleCornerTR} />
          <View style={styles.reticleCornerBL} />
          <View style={styles.reticleCornerBR} />
        </View>

        {/* Indicaciones flotantes en la base del visor */}
        <View style={styles.hintsOverlay}>
          <View style={styles.hintItem}>
            <Sun size={14} color={colors.text.inverse} />
            <Text style={styles.hintText}>Luz natural</Text>
          </View>
          <View style={styles.hintItem}>
            <EyeOff size={14} color={colors.text.inverse} />
            <Text style={styles.hintText}>Sin lentes</Text>
          </View>
          <View style={styles.hintItem}>
            <UserCheck size={14} color={colors.text.inverse} />
            <Text style={styles.hintText}>Rostro centrado</Text>
          </View>
        </View>
      </View>

      {/* Disparador y acciones */}
      <View style={styles.bottomControls}>
        <Text style={styles.repeatNotice}>
          Puedes repetir la foto antes de enviarla
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Capturar fotografía para diagnóstico"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            hapticFeedback.heavy();
            onCapturePhoto?.(mode);
          }}
          style={styles.shutterBtn}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <ButtonGhost
          title="Omitir por ahora"
          onPress={onSkip}
          accessibilityLabel="Omitir captura de fotografía por ahora"
          style={styles.skipBtn}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    color: colors.ink[900],
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  cameraViewport: {
    flex: 1,
    maxHeight: 380,
    backgroundColor: colors.surface.camera,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  guidanceFrame: {
    borderWidth: 2,
    borderColor: colors.surface.input,
    borderStyle: 'dashed',
    position: 'relative',
  },
  faceOval: {
    width: 200,
    height: 270,
    borderRadius: 100,
  },
  bodyRect: {
    width: 170,
    height: 310,
    borderRadius: 24,
  },
  reticleCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.copper[400],
  },
  reticleCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.copper[400],
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.copper[400],
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.copper[400],
  },
  hintsOverlay: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface.hintOverlay,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontSize: 11,
  },
  bottomControls: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  repeatNotice: {
    ...typography.caption,
    color: colors.ink[700],
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
    marginBottom: spacing.xs,
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.ink[900],
  },
  skipBtn: {
    height: 40,
  },
});
