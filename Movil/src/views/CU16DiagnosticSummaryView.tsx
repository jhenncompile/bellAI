import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { ScreenContainer, ButtonPrimary, ButtonSecondary, Card } from '@/shared/ui';
import { colors, typography, spacing, radius } from '@/shared/theme';
import { ArrowLeft, Smile, Palette, User, ChevronRight, Share2 } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';

import { CU12FaceShapeView } from './CU12FaceShapeView';
import { CU13SkinToneView } from './CU13SkinToneView';
import { CU14PersonalPaletteView } from './CU14PersonalPaletteView';
import { CU15SilhouetteView } from './CU15SilhouetteView';
import { CU08PhotoConsentView } from './CU08PhotoConsentView';
import { CU09GuidedCameraView } from './CU09GuidedCameraView';
import { CU10PhotoQualityValidationView } from './CU10PhotoQualityValidationView';
import { CU17RetryAnalysisView } from './CU17RetryAnalysisView';
import { ShareCardModal } from '@/features/share-viral-card';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { AuraScoreData } from '@/entities/aura-score/model/types';
import { ms } from '@/shared/theme/tokens/responsive';

interface CU16DiagnosticSummaryViewProps {
  onBack?: () => void;
  onGoToFaceShape?: () => void;
  onGoToColorimetry?: () => void;
  onGoToSilhouette?: () => void;
  onViewRecommendations?: () => void;
  onStartCameraScan?: () => void;
}

type ActiveDiagnosticModal =
  | 'none'
  | 'faceShape'
  | 'skinTone'
  | 'silhouette'
  | 'palette'
  | 'consent'
  | 'camera'
  | 'qualityValidation'
  | 'retryAnalysis'
  | 'shareCard';

const defaultDiagnostic: DiagnosticResult = {
  id: 'diag-default',
  timestamp: 'Reciente',
  imageUri: '',
  skinTone: 'Dorado suave',
  undertone: 'Calido',
  season: 'Otono Calido (True Autumn)',
  faceShape: 'Ovalado',
  bodyType: 'Natural clásico' as any,
  recommendedMetals: ['Oro'],
  contrastLevel: 'Medio',
  palette: [
    { hex: '#A8604B', name: 'Terracota', category: 'base' },
    { hex: '#8B5E3C', name: 'Café Cálido', category: 'base' },
    { hex: '#D9A441', name: 'Mostaza', category: 'acento' },
    { hex: '#7A8450', name: 'Oliva', category: 'base' },
    { hex: '#B5482E', name: 'Teja', category: 'acento' },
    { hex: '#C97B4A', name: 'Cobre', category: 'acento' },
    { hex: '#D6C5B0', name: 'Arena', category: 'neutro' },
    { hex: '#3E3A36', name: 'Carbón', category: 'neutro' },
  ],
  hairAdvice: {
    recommendedCuts: ['Capas suaves', 'Corte en capas medias'],
    recommendedShades: ['Castaño cálido', 'Cobrizo sutil'],
    avoidShades: ['Negro azulado', 'Rubio platino frío'],
  },
  glassesAdvice: {
    recommendedFrames: ['Montura carey cálido', 'Metal dorado suave'],
    avoidFrames: ['Montura plata fría', 'Geometría muy angulosa'],
  },
};

const defaultScore: AuraScoreData = {
  totalScore: 78,
  tierLabel: 'Armonía equilibrada',
  auraVibe: 'Quiet Luxury',
  breakdown: {
    colorHarmonization: 82,
    facialSymmetry: 76,
    proportionsBalance: 78,
    contrastCoherence: 74,
  },
  audit: {
    baseScore: 100,
    totalPenalties: -22,
    totalBonuses: 0,
    projectedScore: 86,
    projectedTierLabel: 'Armonía superior',
  },
  topVisualErrors: [],
  celebrityMatch: {
    name: 'Estilo Armónico',
    matchPercentage: 92,
    sharedFeatures: 'Proporciones equilibradas y paleta otoñal',
  },
  glowUpPlan: {
    step1: 'Incorpora colores de tu paleta cálida cerca del rostro.',
    step2: 'Prefiere accesorios dorados o cobrizos sobre metales fríos.',
    step3: 'Alinea escotes que equilibren tus proporciones faciales.',
  },
};

export const CU16DiagnosticSummaryView: React.FC<CU16DiagnosticSummaryViewProps> = ({
  onBack,
  onGoToFaceShape,
  onGoToColorimetry,
  onGoToSilhouette,
  onViewRecommendations,
  onStartCameraScan,
}) => {
  const [activeModal, setActiveModal] = useState<ActiveDiagnosticModal>('none');
  const { currentDiagnostic, currentScore } = useScanWorkflow();

  const activeDiag = currentDiagnostic || defaultDiagnostic;
  const activeScoreData = currentScore || defaultScore;

  const handleGoToFaceShape = onGoToFaceShape || (() => setActiveModal('faceShape'));
  const handleGoToColorimetry = onGoToColorimetry || (() => setActiveModal('skinTone'));
  const handleGoToSilhouette = onGoToSilhouette || (() => setActiveModal('silhouette'));
  const handleViewRecommendations = onViewRecommendations || (() => setActiveModal('palette'));
  const handleStartScan = onStartCameraScan || (() => setActiveModal('consent'));

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

      <Text style={styles.title}>Tu diagnóstico</Text>
      <Text style={styles.subtitle}>
        Resultados generados a partir de tu análisis facial y corporal.
      </Text>

      {/* AURA Score Card de Penpot */}
      <Card variant="glass" style={styles.scoreCard}>
        <View style={styles.scoreGaugeRow}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>{activeScoreData.totalScore}</Text>
          </View>
          <View style={styles.scoreTextCol}>
            <Text style={styles.scoreTitle}>Guía de estilo</Text>
            <Text style={styles.scoreHarmonyTag}>{activeScoreData.tierLabel || 'Armonía equilibrada'}</Text>
          </View>
        </View>
        <Text style={styles.scoreDesc}>
          Tus rasgos armonizan bien: lo que más destaca es tu colorimetría
          cálida.
        </Text>
      </Card>

      {/* Tarjeta 1: Resumen rostro */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de la forma de mi rostro"
        onPress={handleGoToFaceShape}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryItemCard}>
          <View style={styles.summaryItemHeader}>
            <View style={styles.iconCircle}>
              <Smile size={20} color={colors.ink[900]} />
            </View>
            <View style={styles.summaryItemText}>
              <Text style={styles.itemCategory}>Forma del rostro</Text>
              <Text style={styles.itemValue}>{activeDiag.faceShape}</Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.itemDesc}>
            Favorece la mayoría de cortes y monturas.
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Tarjeta 2: Resumen colorimetría */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de mi colorimetría estacional"
        onPress={handleGoToColorimetry}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryItemCard}>
          <View style={styles.summaryItemHeader}>
            <View style={styles.iconCircle}>
              <Palette size={20} color={colors.copper[500]} />
            </View>
            <View style={styles.summaryItemText}>
              <Text style={styles.itemCategory}>Colorimetría estacional</Text>
              <Text style={styles.itemValue}>
                {activeDiag.season.includes('Otono')
                  ? 'Otoño cálido'
                  : activeDiag.season}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.itemDesc}>
            Subtono {activeDiag.undertone.toLowerCase()} con alta tolerancia a
            tierras y ocres.
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Tarjeta 3: Resumen silueta */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Consultar detalles de mis proporciones de silueta"
        onPress={handleGoToSilhouette}
        activeOpacity={0.8}
      >
        <Card variant="glass" style={styles.summaryItemCard}>
          <View style={styles.summaryItemHeader}>
            <View style={styles.iconCircle}>
              <User size={20} color={colors.olive[500]} />
            </View>
            <View style={styles.summaryItemText}>
              <Text style={styles.itemCategory}>Tipo de cuerpo</Text>
              <Text style={styles.itemValue}>
                {activeDiag.bodyType || 'Natural clásico'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.ink[400]} />
          </View>
          <Text style={styles.itemDesc}>
            Líneas suaves con estructura equilibrada.
          </Text>
        </Card>
      </TouchableOpacity>

      {/* Botones de acción principal */}
      <View style={styles.actionsContainer}>
        {/* HU-27: Compartir el resultado de mi diagnóstico en redes sociales */}
        <ButtonSecondary
          title="Compartir tarjeta de diagnóstico"
          leftIcon={<Share2 size={18} color={colors.copper[500]} />}
          onPress={() => {
            hapticFeedback.light();
            setActiveModal('shareCard');
          }}
          accessibilityRole="button"
          accessibilityLabel="Compartir tarjeta de diagnóstico en redes sociales"
          accessibilityHint="Abre la vista previa y opciones de privacidad para compartir tu diagnóstico"
          style={styles.actionBtn}
        />

        <ButtonPrimary
          title="Ver recomendaciones para mí"
          onPress={() => {
            hapticFeedback.medium();
            handleViewRecommendations();
          }}
          accessibilityLabel="Ver recomendaciones personalizadas según mi diagnóstico"
          style={styles.actionBtn}
        />

        <ButtonSecondary
          title="Nuevo escaneo con cámara"
          onPress={() => {
            hapticFeedback.light();
            handleStartScan();
          }}
          accessibilityLabel="Iniciar un nuevo escaneo biométrico con la cámara"
          style={styles.actionBtn}
        />
      </View>

      <Text style={styles.footerNote}>
        Guardado en tu perfil · consúltalo cuando quieras
      </Text>

      {/* Modales de Casos de Uso integrados */}

      {/* HU-27: Compartir Tarjeta en Redes Sociales */}
      <Modal
        visible={activeModal === 'shareCard'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <ShareCardModal
          onClose={() => setActiveModal('none')}
          diagnostic={activeDiag}
          scoreData={activeScoreData}
          userPhotoUri={activeDiag.imageUri}
        />
      </Modal>

      {/* CU12: Forma de rostro */}
      <Modal
        visible={activeModal === 'faceShape'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU12FaceShapeView
          onBack={() => setActiveModal('none')}
          onViewFullSummary={() => setActiveModal('none')}
        />
      </Modal>

      {/* CU13: Subtono y colorimetría */}
      <Modal
        visible={activeModal === 'skinTone'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU13SkinToneView
          onBack={() => setActiveModal('none')}
          onViewPalette={() => setActiveModal('palette')}
          onRetakePhoto={() => setActiveModal('camera')}
        />
      </Modal>

      {/* CU14: Paleta personal */}
      <Modal
        visible={activeModal === 'palette'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU14PersonalPaletteView onBack={() => setActiveModal('none')} />
      </Modal>

      {/* CU15: Silueta */}
      <Modal
        visible={activeModal === 'silhouette'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU15SilhouetteView
          onBack={() => setActiveModal('none')}
          onViewSummary={() => setActiveModal('none')}
        />
      </Modal>

      {/* CU08: Consentimiento biométrico */}
      <Modal
        visible={activeModal === 'consent'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU08PhotoConsentView
          onBack={() => setActiveModal('none')}
          onDenyConsent={() => setActiveModal('none')}
          onGrantConsent={() => setActiveModal('camera')}
        />
      </Modal>

      {/* CU09: Cámara guiada */}
      <Modal
        visible={activeModal === 'camera'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU09GuidedCameraView
          onBack={() => setActiveModal('none')}
          onCapturePhoto={() => {
            hapticFeedback.medium();
            setActiveModal('qualityValidation');
          }}
          onSkip={() => setActiveModal('none')}
        />
      </Modal>

      {/* CU10: Validación de calidad fotográfica */}
      <Modal
        visible={activeModal === 'qualityValidation'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU10PhotoQualityValidationView
          onBack={() => setActiveModal('camera')}
          onRetakePhoto={() => setActiveModal('camera')}
          onPickFromGallery={() => setActiveModal('retryAnalysis')}
        />
      </Modal>

      {/* CU17: Reintento de análisis */}
      <Modal
        visible={activeModal === 'retryAnalysis'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal('none')}
      >
        <CU17RetryAnalysisView
          onBack={() => setActiveModal('none')}
          onRetryAnalysis={() => setActiveModal('camera')}
          onUseAnotherPhoto={() => setActiveModal('camera')}
          onSkip={() => setActiveModal('none')}
        />
      </Modal>
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
  scoreCard: {
    padding: spacing.xl,
    borderRadius: 20,
    marginBottom: spacing.md,
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
  scoreHarmonyTag: {
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
  summaryItemCard: {
    padding: spacing.lg,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  summaryItemHeader: {
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
  summaryItemText: {
    flex: 1,
  },
  itemCategory: {
    ...typography.caption,
    color: colors.ink[700],
    fontSize: 12,
  },
  itemValue: {
    ...typography.h4,
    fontSize: 17,
    color: colors.ink[900],
    fontWeight: '700',
  },
  itemDesc: {
    ...typography.bodySmall,
    color: colors.ink[700],
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 56,
  },
  actionsContainer: {
    marginTop: spacing.sm,
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
