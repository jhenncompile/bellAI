import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Lightbulb,
  Lock,
  MessageCircle,
  Palette,
  PersonStanding,
  Plus,
  ScanFace,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wand2,
} from 'lucide-react-native';
import { ContentState } from '@/shared/ui';
import {
  Appear,
  CoralButton,
  CoralCard,
  CoralChip,
  CoralHero,
  CoralIconBox,
  CoralLink,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralShadow,
  coralText,
  useCoral,
  type CoralTokens,
} from '@/shared/ui/coral';
import { ViralCard } from '@/widgets/ViralCard/ui/ViralCard';
import { GuidedCameraModal } from '@/widgets/GuidedCamera/ui/GuidedCameraModal';
import { AnalysisStatusModal } from '@/widgets/GuidedCamera/ui/AnalysisStatusModal';
import { OnboardingModal } from '@/features/onboarding/ui/OnboardingModal';
import { ShareButton } from '@/features/share-viral-card/ui/ShareButton';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { useShareCard } from '@/features/share-viral-card/model/useShareCard';
import { getUserProfile, saveUserProfile } from '@/entities/user/model/storage';
import { UserProfile, DEFAULT_USER_PROFILE } from '@/entities/user/model/types';
import { seasonTitleParts, toneSummary } from '@/entities/diagnostic/model/labels';
import { useAuth } from '@/features/auth/model/AuthContext';
import { profileService } from '@/features/profile/api/profileService';
import { CU08PhotoConsentView } from '@/views';
import { HistoryModal } from '@/widgets/History/HistoryModal';
import { RecommendationReasonModal } from '@/widgets/RecommendationReason/RecommendationReasonModal';
import {
  buildLocalRecommendationReason,
  gatherFullUserContext,
} from '@/features/bellai/model/userContextAggregator';
import type { ConsideredFactorItem } from '@/features/bellai/storage/bellaiHistoryStorage';
import { NoticeOutlet } from '@/shared/ui/Notice';

const MAX_SWATCHES = 5;
/** Tinta fija sobre los iconos pastel (igual en modo claro y oscuro). */
const TILE_INK = '#2A1714';

/** Acceso en cuadrícula: icono pastel, nombre y qué hace. Si está bloqueado, dice cómo se activa. */
function Tile({ title, subtitle, Icon, gradient, locked, onPress }: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  gradient: readonly [string, string];
  locked?: boolean;
  onPress: () => void;
}) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${title}, bloqueado` : title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.card }, coralShadow(c), pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <CoralIconBox gradient={gradient}>
          <Icon size={22} color={TILE_INK} strokeWidth={2.2} />
        </CoralIconBox>
        {locked ? (
          <View style={[styles.lock, { backgroundColor: c.muted }]}>
            <Lock size={14} color={c.ink2} strokeWidth={2.4} />
          </View>
        ) : null}
      </View>
      <Text style={[coralText.strong, { color: c.ink }]} numberOfLines={1}>{title}</Text>
      <Text style={[coralText.caption, { color: c.ink2 }]} numberOfLines={2}>{subtitle}</Text>
    </Pressable>
  );
}

/** Fila de la lista «Más para ti». */
function MoreRow({ title, subtitle, Icon, gradient, onPress, last }: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  gradient: readonly [string, string];
  onPress: () => void;
  last?: boolean;
}) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }, pressed && { opacity: 0.7 }]}
    >
      <CoralIconBox gradient={gradient}>
        <Icon size={20} color={TILE_INK} strokeWidth={2.2} />
      </CoralIconBox>
      <View style={styles.rowCopy}>
        <Text style={[coralText.strong, { color: c.ink }]}>{title}</Text>
        <Text style={[coralText.caption, { color: c.ink2 }]}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={c.ink2} />
    </Pressable>
  );
}

/** Acceso rápido del Inicio con resultados. */
function Quick({ label, Icon, gradient, onPress, busy }: {
  label: string;
  Icon: LucideIcon;
  gradient: readonly [string, string];
  onPress: () => void;
  busy?: boolean;
}) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: Boolean(busy) }}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, coralShadow(c, 6, 14)]}>
        <CoralIconBox gradient={gradient} size={56} radius={20}>
          <Icon size={24} color={TILE_INK} strokeWidth={2.2} />
        </CoralIconBox>
      </View>
      <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink, textAlign: 'center' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Avance del perfil: preferencias, foto y paleta. */
function ProfileProgress({ c, onboarded, hasPhoto }: { c: CoralTokens; onboarded: boolean; hasPhoto: boolean }) {
  const steps = [
    { label: 'Preferencias', done: onboarded },
    { label: 'Foto', done: hasPhoto },
    { label: 'Tu paleta', done: hasPhoto },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  return (
    <CoralCard radius={24} style={styles.progress}>
      <View
        style={styles.progressHead}
        accessible
        accessibilityLabel={`Tu perfil de estilo: ${doneCount} de 3 listo. ${steps.map((s) => `${s.label}, ${s.done ? 'listo' : 'pendiente'}`).join('. ')}`}
      >
        <Text style={[coralText.label, { fontFamily: coralFonts.extrabold, color: c.ink }]}>Tu perfil de estilo</Text>
        <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.accent }]}>{doneCount} de 3 listo</Text>
      </View>
      <View style={styles.progressSteps} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {steps.map((s, i) => {
          const now = i === current;
          return (
            <View key={s.label} style={styles.progressStep}>
              <View
                style={[
                  styles.dot,
                  s.done
                    ? { backgroundColor: c.accent }
                    : now
                      ? { backgroundColor: c.card, borderWidth: 2, borderColor: c.accent }
                      : { backgroundColor: c.muted },
                ]}
              >
                {s.done ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : (
                  <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: now ? c.accent : c.ink2 }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[coralText.caption, { fontFamily: now ? coralFonts.extrabold : coralFonts.semibold, color: s.done || now ? c.ink : c.ink2 }]}>
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>
    </CoralCard>
  );
}

/**
 * Inicio (propuesta P1). Primera visita: el siguiente paso explícito, el avance del perfil y
 * accesos que dicen qué hacen. Con resultados: la paleta, el look de hoy y accesos rápidos.
 */
export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const c = useCoral();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string>();
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraMode, setCameraMode] = useState<'face' | 'body'>('face');
  const [cameraTips, setCameraTips] = useState(false);
  // Mi análisis abre la cámara directamente con `/?capture=face|body`.
  const { capture } = useLocalSearchParams<{ capture?: string }>();
  const [showShareCard, setShowShareCard] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [reasonModal, setReasonModal] = useState<{
    visible: boolean;
    title: string;
    reasonSummary: string;
    consideredFactors: ConsideredFactorItem[];
    contextSummary: string;
  }>({
    visible: false,
    title: '',
    reasonSummary: '',
    consideredFactors: [],
    contextSummary: '',
  });

  const {
    isScanning,
    currentDiagnostic,
    currentScore,
    isRestoring,
    restoreError,
    reloadDiagnostic,
    clearRestoreError,
    pickFromGallery,
    loadSampleDiagnostic,
    processImageUri,
    photoConsentVisible,
    photoConsentSubmitting,
    photoConsentError,
    grantPhotoConsent,
    denyPhotoConsent,
    processBodyUri,
    scanProgress,
    analysisOutcome,
    clearAnalysisOutcome,
  } = useScanWorkflow();

  const { cardRef, isSharing, captureAndShare } = useShareCard();

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    let profile = await getUserProfile();
    if (user?.id) {
      try {
        const remote = await profileService.getProfile();
        const preferences = remote.preferences.stylePreferences || {};
        profile = {
          ...profile,
          id: remote.id,
          name: remote.name,
          email: remote.email,
          goals: (preferences.goals || profile.goals) as UserProfile['goals'],
          preferredStyles: (preferences.preferredStyles || profile.preferredStyles) as UserProfile['preferredStyles'],
          dislikedStyles: (preferences.dislikedStyles || profile.dislikedStyles) as UserProfile['dislikedStyles'],
          occasions: (preferences.occasions || profile.occasions) as UserProfile['occasions'],
          isOnboarded: profile.isOnboarded || Boolean(preferences.preferredStyles?.length),
        };
        await saveUserProfile(profile);
      } catch (error) {
        console.warn('[HomeScreen] No se pudo sincronizar el perfil; se usará la copia local:', error);
      }
    }
    return profile;
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    void loadProfile().then((profile) => {
      if (!isMounted) return;
      setUserProfile(profile);
      if (!profile.isOnboarded) setShowOnboarding(true);
    });

    return () => {
      isMounted = false;
    };
  }, [loadProfile]);

  const handleOnboardingComplete = async (newProfile: UserProfile) => {
    const profileToSave: UserProfile = {
      ...newProfile,
      id: user?.id || newProfile.id,
      name: user?.name || newProfile.name,
      email: user?.email || newProfile.email,
    };
    try {
      await profileService.updatePreferences({
        goals: profileToSave.goals,
        preferredStyles: profileToSave.preferredStyles,
        dislikedStyles: profileToSave.dislikedStyles,
        occasions: profileToSave.occasions,
      });
      const savedLocally = await saveUserProfile(profileToSave);
      if (!savedLocally) throw new Error('No se pudo guardar el perfil en el dispositivo.');
      setUserProfile(profileToSave);
      setOnboardingError(undefined);
      setShowOnboarding(false);
    } catch {
      setOnboardingError('Revisa tu conexión e inténtalo de nuevo. La pantalla sigue abierta para que puedas reintentar.');
    }
  };

  const handleGuidedCapture = async (uri: string, mode: 'face' | 'body' = 'face') => {
    if (mode === 'body') {
      await processBodyUri(uri);
    } else {
      await processImageUri(uri);
    }
  };

  const firstName = (user?.name || userProfile.name || '').trim().split(/\s+/)[0];
  const season = currentDiagnostic ? seasonTitleParts(currentDiagnostic.season) : null;
  const hasResults = Boolean(currentDiagnostic && season);
  const go = (href: string) => router.push(href as Href);
  const openCamera = (mode: 'face' | 'body' = 'face', tips = false) => {
    setCameraMode(mode);
    setCameraTips(tips);
    setShowCameraModal(true);
  };

  // Abre la cámara una vez por cada pedido que llega desde Mi análisis (durante el render, sin efecto).
  const [handledCapture, setHandledCapture] = useState<string | undefined>(undefined);
  if (capture !== handledCapture) {
    setHandledCapture(capture);
    if (capture === 'face' || capture === 'body') {
      setCameraMode(capture);
      setCameraTips(false);
      setShowCameraModal(true);
    }
  }
  useEffect(() => {
    if (capture) router.setParams({ capture: undefined });
  }, [capture, router]);

  const openReason = async () => {
    const ctx = await gatherFullUserContext(currentDiagnostic);
    const reason = buildLocalRecommendationReason(ctx, {
      title: currentDiagnostic ? `Paleta y estilo ${currentDiagnostic.season}` : 'Recomendaciones para tu perfil',
      category: 'general',
    });
    setReasonModal({
      visible: true,
      title: reason.title,
      reasonSummary: reason.reasonSummary,
      consideredFactors: reason.consideredFactors,
      contextSummary: reason.contextBadgeText,
    });
  };

  return (
    <CoralScreen withTabBar>
      <View style={styles.content}>
        <View style={styles.header}>
          <CoralTitle prefix={firstName ? 'Hola, ' : 'Tu estilo, '} accent={firstName || 'a tu manera'} size={30} />
          <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>
            {hasResults ? 'Esto es lo que te favorece hoy' : 'Te falta un paso para ver tu paleta'}
          </Text>
        </View>

        {isRestoring ? (
          <CoralCard><ContentState loading title="Recuperando tu análisis" /></CoralCard>
        ) : restoreError ? (
          <CoralCard style={styles.restoreBox}>
            <ContentState title="No pudimos recuperar tu análisis" description={restoreError} actionLabel="Reintentar" onAction={reloadDiagnostic} />
            {/* Del Líder («fix models»): otras salidas cuando no se puede recuperar el análisis. */}
            <CoralButton
              title="Tomar una foto nueva"
              variant="secondary"
              height={44}
              onPress={() => { clearRestoreError(); openCamera(); }}
              leftIcon={<Camera size={18} color={c.ink} strokeWidth={2.2} />}
              fullWidth
            />
            <CoralLink title="Elegir de la galería" underline onPress={() => { clearRestoreError(); void pickFromGallery(); }} />
            <CoralLink title="Ver un análisis de ejemplo" underline onPress={() => { clearRestoreError(); void loadSampleDiagnostic(); }} accessibilityHint="Muestra un resultado de prueba para conocer la app" />
          </CoralCard>
        ) : currentDiagnostic && season ? (
          <CoralHero
            style={styles.hero}
            glow={{ right: -30, top: -40, size: 220 }}
            accessibilityLabel={`Tu paleta: ${season.lead}${season.accent}`}
          >
            <CoralChip label="Tu paleta" height={28} icon={<Palette size={14} color={c.accent} strokeWidth={2.2} />} />
            <CoralTitle prefix={season.lead} accent={season.accent} size={32} color={c.heroInk} accentColor={c.heroInk} style={styles.season} />
            <Text style={[coralText.label, { color: c.heroInk }]}>
              {toneSummary(currentDiagnostic.undertone, currentDiagnostic.contrastLevel)}
            </Text>
            <View style={styles.swatches}>
              {currentDiagnostic.palette.slice(0, MAX_SWATCHES).map((swatch, index) => (
                <View
                  key={swatch.hex + swatch.name}
                  accessible
                  accessibilityLabel={swatch.name}
                  style={[styles.swatch, { backgroundColor: swatch.hex, marginLeft: index === 0 ? 0 : -10 }]}
                />
              ))}
            </View>
            <CoralButton
              title="Ver mi análisis completo"
              height={44}
              onPress={() => go('/studio')}
              rightIcon={<ArrowRight size={18} color={c.onPrimary} strokeWidth={2.2} />}
              fullWidth
            />
          </CoralHero>
        ) : (
          <>
            <CoralHero style={styles.hero} glow={{ right: -10, top: 40, size: 200 }}>
              <Mascot pose="camara" height={105} style={styles.heroMascot} enter="pop" />
              <CoralChip label={`Paso ${userProfile.isOnboarded ? 2 : 1} de 3`} height={28} />
              <Text accessibilityRole="header" style={[styles.stepTitle, { color: c.heroInk }]}>Toma tu primera foto</Text>
              <Text style={[coralText.small, styles.stepCopy, { color: c.heroInk }]}>
                Con luz natural calculamos tu tono y tu paleta.
              </Text>
              <CoralButton
                title={isScanning ? `Analizando… ${scanProgress}%` : 'Tomar mi foto'}
                height={44}
                onPress={() => openCamera()}
                disabled={isScanning}
                leftIcon={<Camera size={18} color={c.onPrimary} strokeWidth={2.2} />}
                style={styles.stepButton}
              />
            </CoralHero>
            <Appear delay={120}>
              <ProfileProgress c={c} onboarded={userProfile.isOnboarded} hasPhoto={false} />
            </Appear>
          </>
        )}

        {hasResults ? (
          <>
            <Appear delay={120} style={styles.section}>
              <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Para hoy</Text>
              <CoralCard radius={24} style={styles.look}>
                <Mascot pose="ropa" height={78} style={styles.lookMascot} />
                <View style={styles.lookCopy}>
                  <Text style={[coralText.strong, { fontSize: 17, lineHeight: 21, color: c.ink }]}>Arma tu look de hoy</Text>
                  <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>
                    Combinamos prendas de tu armario con tu paleta, la ocasión y el clima.
                  </Text>
                  <View style={styles.lookActions}>
                    <CoralButton title="Generar outfit" variant="secondary" height={36} onPress={() => go('/outfits')} />
                    <CoralLink
                      title="¿Por qué?"
                      underline
                      onPress={() => { void openReason(); }}
                      accessibilityLabel="Por qué te favorecen tus colores y prendas"
                    />
                  </View>
                </View>
              </CoralCard>
            </Appear>

            <Appear delay={220} style={styles.section}>
              <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Accesos rápidos</Text>
              <View style={styles.quickRow}>
                <Quick
                  label={isScanning ? `${scanProgress}%` : 'Nueva foto'}
                  Icon={Camera}
                  gradient={c.tiles[0]}
                  onPress={() => openCamera()}
                  busy={isScanning}
                />
                <Quick label="Prenda" Icon={Plus} gradient={c.tiles[1]} onPress={() => go('/wardrobe')} />
                <Quick label="Preguntar" Icon={MessageCircle} gradient={c.tiles[2]} onPress={() => go('/advisor')} />
                {currentScore ? (
                  <Quick label={showShareCard ? 'Ocultar' : 'Compartir'} Icon={Heart} gradient={c.tiles[3]} onPress={() => setShowShareCard((v) => !v)} />
                ) : null}
                <Quick label="Historial" Icon={Clock} gradient={c.tiles[0]} onPress={() => setShowHistoryModal(true)} />
              </View>
            </Appear>

            {showShareCard && currentScore && currentDiagnostic ? (
              <View style={styles.section}>
                <ViralCard forwardedRef={cardRef} scoreData={currentScore} diagnostic={currentDiagnostic} userPhotoUri={currentDiagnostic.imageUri} />
                <ShareButton onPress={() => captureAndShare(currentScore.totalScore)} loading={isSharing} />
              </View>
            ) : null}
          </>
        ) : (
          <Appear delay={220} style={styles.section}>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Explora BellAI</Text>
            <View style={styles.grid}>
              <Tile title="Mi armario" subtitle="Guarda tus prendas" Icon={Shirt} gradient={c.tiles[0]} onPress={() => go('/wardrobe')} />
              <Tile title="Asistente" subtitle="Resuelve tus dudas" Icon={MessageCircle} gradient={c.tiles[1]} onPress={() => go('/advisor')} />
              <Tile title="Mi análisis" subtitle="Se activa con tu foto" Icon={ScanFace} gradient={c.tiles[2]} locked onPress={() => openCamera()} />
              <Tile title="Historial" subtitle="Tus resultados" Icon={Clock} gradient={c.tiles[3]} onPress={() => setShowHistoryModal(true)} />
            </View>
          </Appear>
        )}

        <Appear delay={320} style={styles.section}>
          <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Más para ti</Text>
          <CoralCard radius={24} padding={0} style={styles.more}>
            {!hasResults ? (
              <MoreRow title="Generar outfit" subtitle="Según la ocasión y el clima" Icon={Sparkles} gradient={c.tiles[0]} onPress={() => go('/outfits')} />
            ) : null}
            <MoreRow title="¿Me lo compro?" subtitle="Semáforo para prendas en tienda" Icon={ShoppingBag} gradient={c.tiles[1]} onPress={() => go('/compatibility')} />
            <MoreRow title="Mi estilo" subtitle="Tu Style DNA y recomendaciones explicadas" Icon={Palette} gradient={c.tiles[2]} onPress={() => go('/style')} />
            <MoreRow title="Probador virtual" subtitle="Cabello, maquillaje, uñas y gafas sobre tu foto" Icon={Wand2} gradient={c.tiles[3]} onPress={() => go('/simulator')} />
            <MoreRow title="Mi avatar 3D" subtitle="Tus proporciones vestidas con tus outfits" Icon={PersonStanding} gradient={c.tiles[0]} onPress={() => go('/avatar')} last={hasResults} />
            {!hasResults ? (
              <MoreRow
                title="Motivo de recomendaciones"
                subtitle="Por qué te sugerimos colores y prendas"
                Icon={Lightbulb}
                gradient={c.tiles[1]}
                onPress={() => { void openReason(); }}
                last
              />
            ) : null}
          </CoralCard>
        </Appear>
      </View>

      {/* Modal de Onboarding Inteligente */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        errorMessage={onboardingError}
      />

      {/* Modal de Captura Guiada en Tiempo Real */}
      <GuidedCameraModal
        visible={showCameraModal}
        initialMode={cameraMode}
        showTips={cameraTips}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleGuidedCapture}
      />

      {/* A5 a A7: analizando, listo y error (Penpot «Flujo 02 · Análisis») */}
      <AnalysisStatusModal
        scanning={isScanning}
        progress={scanProgress}
        outcome={showCameraModal || photoConsentVisible ? null : analysisOutcome}
        season={season}
        summary={currentDiagnostic ? toneSummary(currentDiagnostic.undertone, currentDiagnostic.contrastLevel) : undefined}
        swatches={currentDiagnostic?.palette}
        onSeeResults={() => { clearAnalysisOutcome(); go('/studio'); }}
        onRetry={(mode, tips) => { clearAnalysisOutcome(); openCamera(mode, tips); }}
        onClose={clearAnalysisOutcome}
      />

      <Modal
        visible={photoConsentVisible}
        animationType="slide"
        onRequestClose={() => { void denyPhotoConsent(); }}
      >
        <CU08PhotoConsentView
          onBack={() => { void denyPhotoConsent(); }}
          onGrantConsent={() => { void grantPhotoConsent(); }}
          onDenyConsent={() => { void denyPhotoConsent(); }}
          submitting={photoConsentSubmitting}
          errorMessage={photoConsentError}
        />
        <NoticeOutlet />
      </Modal>

      <RecommendationReasonModal
        visible={reasonModal.visible}
        onClose={() => setReasonModal((prev) => ({ ...prev, visible: false }))}
        recommendationTitle={reasonModal.title}
        reasonSummary={reasonModal.reasonSummary}
        consideredFactors={reasonModal.consideredFactors}
        contextSummary={reasonModal.contextSummary}
      />

      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  restoreBox: { gap: 8, alignItems: 'stretch' },
  content: { gap: 18, paddingTop: 4 },
  header: { gap: 4, paddingHorizontal: 8 },
  pressed: { transform: [{ scale: 0.97 }] },
  hero: { padding: 18, gap: 8, minHeight: 220 },
  heroMascot: { position: 'absolute', right: 10, bottom: 12 },
  stepTitle: { fontFamily: coralFonts.title, fontSize: 23, lineHeight: 26, letterSpacing: -0.4, maxWidth: '68%', marginTop: 4 },
  stepCopy: { maxWidth: '66%' },
  stepButton: { alignSelf: 'flex-start', marginTop: 8 },
  season: { marginTop: 4 },
  swatches: { flexDirection: 'row', marginVertical: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  progress: { gap: 14 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // En teléfonos angostos los pasos bajan de línea en vez de chocar.
  progressSteps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, columnGap: 12 },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 112, borderRadius: 22, padding: 14, gap: 4 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  lock: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  look: { minHeight: 140, overflow: 'hidden' },
  lookCopy: { gap: 6, paddingRight: 76 },
  lookMascot: { position: 'absolute', right: 10, bottom: 8 },
  lookActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quick: { flex: 1, alignItems: 'center', gap: 8, minHeight: 44 },
  quickIcon: { borderRadius: 20 },
  more: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10 },
  rowCopy: { flex: 1, gap: 2 },
});
