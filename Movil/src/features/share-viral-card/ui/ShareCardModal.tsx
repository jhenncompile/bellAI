import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { ScreenContainer, Card, ButtonSecondary } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { ViralCard } from '@/widgets/ViralCard';
import { useShareCard } from '../model/useShareCard';
import { ShareButton } from './ShareButton';
import { AuraScoreData } from '@/entities/aura-score/model/types';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';

export interface ShareCardModalProps {
  onClose: () => void;
  diagnostic: DiagnosticResult;
  scoreData: AuraScoreData;
  userPhotoUri?: string;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  onClose,
  diagnostic,
  scoreData,
  userPhotoUri,
}) => {
  const [includePhoto, setIncludePhoto] = useState(false);
  const { cardRef, isSharing, captureAndShare } = useShareCard();

  const handleTogglePhoto = (val: boolean) => {
    hapticFeedback.light();
    if (val && !userPhotoUri) {
      Alert.alert(
        'Fotografía no disponible',
        'No se encontró una fotografía facial asociada a este diagnóstico. La tarjeta se generará con avatar protegido.',
        [{ text: 'Entendido', style: 'default' }]
      );
      setIncludePhoto(false);
      return;
    }
    setIncludePhoto(val);
  };

  const handleShare = async () => {
    await captureAndShare(scoreData?.totalScore ?? 78, {
      season: diagnostic?.season,
    });
  };

  return (
    <ScreenContainer scrollable={false} style={styles.modalScreen}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cerrar modal de compartir"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            hapticFeedback.light();
            onClose();
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={colors.ink[900]} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Compartir diagnóstico</Text>
          <Text style={styles.headerSubtitle}>
            Tarjeta de estilo para personas de tu confianza
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vista previa de la tarjeta que se exportará */}
        <View style={styles.previewContainer}>
          <ViralCard
            forwardedRef={cardRef}
            scoreData={scoreData}
            diagnostic={diagnostic}
            userPhotoUri={userPhotoUri}
            includePhoto={includePhoto}
          />
        </View>

        {/* Sección de Privacidad y Control de Datos Sensibles (Criterio 3 de HU-27) */}
        <Card variant="glass" style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <View style={styles.shieldIconBox}>
              <ShieldCheck size={20} color={colors.copper[500]} />
            </View>
            <View style={styles.privacyHeaderText}>
              <Text style={styles.privacyTitle}>Privacidad de tus datos</Text>
              <Text style={styles.privacySubtitle}>
                Protección activa de datos sensibles y biométricos
              </Text>
            </View>
          </View>

          <Text style={styles.privacyExplanation}>
            Tu tarjeta no incluye nombre, correo ni datos biométricos privados.
            Por defecto, tu fotografía facial se mantiene oculta para proteger tu
            identidad.
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Incluir mi foto en la tarjeta</Text>
              <Text style={styles.toggleDesc}>
                {includePhoto
                  ? 'Autorizado: tu fotografía será visible al compartir.'
                  : 'Protegido: se mostrará un avatar anónimo de estilo.'}
              </Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Autorizar inclusión de fotografía facial en la tarjeta de redes"
              accessibilityHint="Activa o desactiva la visualización de tu foto en la imagen a compartir"
              value={includePhoto}
              onValueChange={handleTogglePhoto}
              trackColor={{
                false: colors.border.medium,
                true: colors.copper[500],
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Acciones principales */}
        <View style={styles.actionsContainer}>
          <ShareButton
            title="Compartir en redes sociales"
            onPress={handleShare}
            loading={isSharing}
            disabled={isSharing}
            style={styles.shareBtn}
          />

          <ButtonSecondary
            title="Volver al diagnóstico"
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Volver al resumen de diagnóstico"
            style={styles.closeBtn}
          />

          <Text style={styles.footnote}>
            Se abrirá el selector de aplicaciones de tu teléfono (WhatsApp,
            Instagram, mensajería y más).
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  modalScreen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 20,
    color: colors.ink[900],
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.caption,
    fontSize: 12,
    color: colors.ink[700],
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  previewContainer: {
    paddingVertical: spacing.md,
  },
  privacyCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  shieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyHeaderText: {
    flex: 1,
  },
  privacyTitle: {
    ...typography.h4,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  privacySubtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.copper[600],
    fontWeight: '600',
  },
  privacyExplanation: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.ink[700],
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing.md,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    ...typography.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  toggleDesc: {
    ...typography.caption,
    fontSize: 12,
    color: colors.ink[600],
    marginTop: 2,
  },
  actionsContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  shareBtn: {
    width: '100%',
  },
  closeBtn: {
    width: '100%',
  },
  footnote: {
    ...typography.caption,
    color: colors.ink[400],
    textAlign: 'center',
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
