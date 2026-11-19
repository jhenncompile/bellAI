import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Copy, Layers, Palette, Shirt } from 'lucide-react-native';
import { Banner, ContentState, useNotice } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralLink,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { TrafficLight } from '@/features/bellai/ui/components';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  CompatibilityLevel,
  EvaluateStoreGarmentPayload,
  StoreGarmentEvaluationResponse,
  WardrobeCategory,
  WardrobeOccasion,
  WardrobeSeason,
} from '@/features/digital-wardrobe/types/wardrobe.types';
import { wardrobeService } from '@/features/digital-wardrobe/services/wardrobeService';
import { analyzeGarmentImage } from '@/features/digital-wardrobe/services/garmentImageAnalyzer';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import { PhotoAnalysisConsentRequiredError } from '@/features/privacy/api/privacyService';

interface CU24EvaluateStoreItemViewProps {
  onBack?: () => void;
  /** Guarda la prenda evaluada; si devuelve una promesa, el botón muestra la espera. */
  onSaveToWardrobe?: (evaluation: StoreGarmentEvaluationResponse, photoUri: string | null) => void | Promise<void>;
}

type ScreenStage = 'capture' | 'analyzing' | 'result' | 'error';

/** Nivel del backend → semáforo de la app (icono + texto, no solo color). */
const LIGHT_BY_LEVEL: Record<CompatibilityLevel, 'verde' | 'amarillo' | 'rojo'> = {
  alto: 'verde',
  medio: 'amarillo',
  bajo: 'rojo',
};

/** CU-24 · Evaluar en tienda si una prenda es compatible con mi perfil y mi armario (HU-24). */
export const CU24EvaluateStoreItemView: React.FC<CU24EvaluateStoreItemViewProps> = ({
  onBack,
  onSaveToWardrobe,
}) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const { notify } = useNotice();
  const [stage, setStage] = useState<ScreenStage>('capture');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [garmentName, setGarmentName] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<WardrobeCategory>('superior');
  const [detectedColor, setDetectedColor] = useState<string>('Neutro');
  // Sin color detectado no se inventa uno: no se envía ni se pinta muestra
  const [detectedColorHex, setDetectedColorHex] = useState<string | null>(null);
  const [selectedSeason] = useState<WardrobeSeason>('todo_el_ano');
  const [selectedOccasion] = useState<WardrobeOccasion>('casual');
  const [evaluation, setEvaluation] = useState<StoreGarmentEvaluationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState<'camera' | 'gallery' | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePickFromCamera = async () => {
    try {
      void hapticFeedback.light();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied('camera');
        return;
      }
      setPermissionDenied(null);

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        await processCapturedPhoto(res.assets[0].uri);
      }
    } catch {
      notify({ kind: 'error', message: 'No pudimos abrir la cámara. Revisa los permisos del teléfono e inténtalo de nuevo.' });
    }
  };

  const handlePickFromGallery = async () => {
    try {
      void hapticFeedback.light();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied('gallery');
        return;
      }
      setPermissionDenied(null);

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        await processCapturedPhoto(res.assets[0].uri);
      }
    } catch {
      notify({ kind: 'error', message: 'No pudimos abrir tus fotos. Revisa los permisos del teléfono e inténtalo de nuevo.' });
    }
  };

  const processCapturedPhoto = async (uri: string) => {
    setPhotoUri(uri);
    setStage('analyzing');
    setErrorMessage('');

    try {
      // 1. Análisis visual de la foto mediante analizador de prendas
      const visualAnalysis = await analyzeGarmentImage(uri);
      const color = visualAnalysis.colorName || visualAnalysis.dominantColor?.name || 'Neutro';
      const colorHex = visualAnalysis.dominantColor?.hex || undefined;
      const category = (visualAnalysis.typeSuggestion?.category as WardrobeCategory) || 'superior';
      const name = visualAnalysis.typeSuggestion?.label || `Prenda ${CATEGORY_LABELS[category] || ''}`;

      setDetectedColor(color);
      setDetectedColorHex(colorHex ?? null);
      setSelectedCategory(category);
      setGarmentName(name);

      // 2. Evaluación de compatibilidad con backend
      await runEvaluation({
        name,
        category,
        color,
        colorHex,
        season: selectedSeason,
        occasion: selectedOccasion,
      }, uri);
    } catch (error) {
      setStage('error');
      setErrorMessage(
        error instanceof PhotoAnalysisConsentRequiredError
          ? 'Para analizar la foto, autoriza el análisis de fotografías en Perfil · Privacidad y datos.'
          : 'No pudimos completar el análisis de la fotografía. Comprueba tu conexión o reintenta con otra imagen.',
      );
    }
  };

  const runEvaluation = async (
    payload: EvaluateStoreGarmentPayload,
    uriToUse?: string | null,
  ) => {
    setStage('analyzing');
    setErrorMessage('');
    try {
      const result = await wardrobeService.evaluateStoreGarment(
        payload,
        uriToUse || photoUri || undefined,
      );
      setEvaluation(result);
      setStage('result');
      void hapticFeedback.success();
    } catch {
      setStage('error');
      setErrorMessage(
        'No fue posible evaluar la compatibilidad en este momento. Inténtalo nuevamente.',
      );
      void hapticFeedback.warning();
    }
  };

  const renderItemCards = (items: StoreGarmentEvaluationResponse['matchingWardrobeItems']) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchList}>
      {items.map((item, i) => {
        const resolvedPhoto = EnvConfig.resolveImageUrl(item.photoUrl);
        return (
          <CoralCard key={item.id} radius={22} padding={0} style={styles.matchCard}>
            <View
              accessible
              accessibilityLabel={[item.name, item.categoryLabel, item.matchReason].filter(Boolean).join('. ')}
            >
              {resolvedPhoto ? (
                <Image source={{ uri: resolvedPhoto }} style={styles.matchImage} />
              ) : (
                <LinearGradient colors={c.tiles[i % 4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.matchImage}>
                  <Shirt size={28} color={c.ink} strokeWidth={1.8} />
                </LinearGradient>
              )}
              <View style={styles.matchCopy}>
                <Text style={[coralText.strong, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{item.categoryLabel}</Text>
                <Text style={[coralText.caption, { color: c.ink2 }]} numberOfLines={3}>{item.matchReason}</Text>
              </View>
            </View>
          </CoralCard>
        );
      })}
    </ScrollView>
  );

  const handleReset = () => {
    void hapticFeedback.light();
    setStage('capture');
    setPhotoUri(null);
    setEvaluation(null);
    setErrorMessage('');
  };

  const handleConfirmSave = async () => {
    if (!evaluation || saving) return;
    void hapticFeedback.success();
    if (!onSaveToWardrobe) {
      notify({ kind: 'info', message: 'La prenda y su análisis están listos para agregarse a tu armario.' });
      return;
    }
    setSaving(true);
    try {
      await onSaveToWardrobe(evaluation, photoUri);
    } finally {
      setSaving(false);
    }
  };

  const busy = stage === 'analyzing';

  return (
    <LinearGradient colors={c.background} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado */}
        <View style={styles.topBar}>
          {onBack ? <CoralBackButton label="Volver al armario" onPress={onBack} disabled={saving} /> : null}
          <CoralTitle prefix="Evaluar en " accent="tienda" size={26} style={styles.flex} />
        </View>
        <Text style={[coralText.small, { color: c.ink2 }]}>
          Comprueba si una prenda va con tu colorimetría y con lo que ya tienes antes de comprarla.
        </Text>

        {/* 1. Captura de la fotografía */}
        {stage === 'capture' ? (
          <>
            <ContentState
              icon={<Mascot pose="fotografo" height={130} enter="pop" />}
              title="¿Viste una prenda en una tienda?"
              description="Fotografíala sobre un fondo liso o colgada. Revisamos si el color favorece tu subtono y con qué prendas de tu armario combina."
            />
            {permissionDenied ? (
              <Banner
                kind="warning"
                title={permissionDenied === 'camera' ? 'Sin permiso para la cámara' : 'Sin permiso para tus fotos'}
                description={
                  permissionDenied === 'camera'
                    ? 'Actívalo en los ajustes del teléfono para fotografiar la prenda.'
                    : 'Actívalo en los ajustes del teléfono para elegir una foto.'
                }
                actionLabel="Abrir ajustes"
                onAction={() => { void Linking.openSettings(); }}
              />
            ) : null}
            <CoralButton
              title="Fotografiar prenda"
              fullWidth
              accessibilityLabel="Fotografiar la prenda con la cámara"
              onPress={() => { void handlePickFromCamera(); }}
              leftIcon={<Camera size={18} color={c.onPrimary} strokeWidth={2.2} />}
            />
            <CoralLink
              title="Elegir de la galería"
              underline
              accessibilityLabel="Elegir una foto de la galería"
              onPress={() => { void handlePickFromGallery(); }}
              style={styles.centerSelf}
            />
          </>
        ) : null}

        {/* 2. Analizando */}
        {busy ? (
          <ContentState
            kind="thinking"
            title="Analizando la prenda"
            description="Revisamos tu colorimetría y buscamos prendas de tu armario que combinen."
          />
        ) : null}

        {/* 3. Error con reintento */}
        {stage === 'error' ? (
          <>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: c.muted }]} resizeMode="cover" accessibilityLabel="Prenda a evaluar" />
            ) : null}
            <Banner
              kind="error"
              title="No pudimos evaluar la prenda"
              description={errorMessage}
              actionLabel="Reintentar"
              onAction={() => {
                if (photoUri) {
                  void processCapturedPhoto(photoUri);
                } else {
                  handleReset();
                }
              }}
            />
            <CoralLink title="Tomar otra foto" underline onPress={handleReset} style={styles.centerSelf} />
          </>
        ) : null}

        {/* 4. Resultado */}
        {stage === 'result' && evaluation ? (
          <Appear style={styles.result}>
            {/* Veredicto */}
            <CoralCard radius={24} style={styles.card}>
              <View style={styles.verdictHead}>
                <TrafficLight light={LIGHT_BY_LEVEL[evaluation.compatibilityLevel] ?? 'amarillo'} />
                <Text style={[coralText.label, { color: c.ink }]}>{evaluation.compatibilityScore} % de compatibilidad</Text>
              </View>
              <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>{evaluation.verdictTitle}</Text>
              <Text style={[coralText.body, { color: c.ink2 }]}>{evaluation.summary}</Text>

              {photoUri ? (
                <View style={[styles.preview, { backgroundColor: c.muted }]}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} accessibilityLabel="Prenda evaluada" />
                  <View style={styles.previewInfo}>
                    <Text style={[coralText.strong, { color: c.ink }]}>{garmentName}</Text>
                    <View style={styles.row}>
                      {detectedColorHex ? (
                        <View style={[styles.dot, { backgroundColor: detectedColorHex, borderColor: c.fieldStroke }]} />
                      ) : null}
                      <Text style={[coralText.small, styles.flex, { color: c.ink2 }]}>{detectedColor}</Text>
                    </View>
                    <Text style={[coralText.caption, { color: c.ink2 }]}>
                      Categoría: {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                    </Text>
                    {evaluation.detectedFromPhoto?.subcategory ? (
                      <Text style={[coralText.caption, { color: c.ink2 }]}>
                        Tipo: {SUBCATEGORY_LABELS[evaluation.detectedFromPhoto.subcategory as keyof typeof SUBCATEGORY_LABELS] || evaluation.detectedFromPhoto.subcategory}
                        {evaluation.detectedFromPhoto.pattern && evaluation.detectedFromPhoto.pattern !== 'liso' ? ` · estampado ${evaluation.detectedFromPhoto.pattern}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </CoralCard>

            {/* Colorimetría personal */}
            <CoralCard radius={24} style={styles.card}>
              <View style={styles.row}>
                <Palette size={20} color={c.ink} strokeWidth={2.2} />
                <Text accessibilityRole="header" style={[coralText.strong, styles.flex, { color: c.ink }]}>Colorimetría y armonía personal</Text>
              </View>
              <Text style={[coralText.small, { color: c.ink2 }]}>{evaluation.colorAnalysis.description}</Text>
              <View style={styles.tags}>
                {evaluation.colorAnalysis.userSeason ? (
                  <View style={[styles.tag, { backgroundColor: c.muted }]}>
                    <Text style={[coralText.caption, styles.tagText, { color: c.ink }]}>Estación: {evaluation.colorAnalysis.userSeason}</Text>
                  </View>
                ) : null}
                {evaluation.colorAnalysis.userUndertone ? (
                  <View style={[styles.tag, { backgroundColor: c.muted }]}>
                    <Text style={[coralText.caption, styles.tagText, { color: c.ink }]}>Subtono: {evaluation.colorAnalysis.userUndertone}</Text>
                  </View>
                ) : null}
              </View>
            </CoralCard>

            {/* Integración con el armario */}
            <CoralCard radius={24} style={styles.card}>
              <View style={styles.row}>
                <Layers size={20} color={c.ink} strokeWidth={2.2} />
                <Text accessibilityRole="header" style={[coralText.strong, styles.flex, { color: c.ink }]}>Integración con tu armario</Text>
              </View>
              <Text style={[coralText.small, { color: c.ink2 }]}>{evaluation.wardrobeAnalysis.description}</Text>
            </CoralCard>

            {/* Prendas que ya tiene casi iguales: evita comprar un duplicado */}
            {evaluation.similarWardrobeItems?.length ? (
              <View style={styles.matching}>
                <View style={styles.row}>
                  <Copy size={20} color={c.ink} strokeWidth={2.2} />
                  <Text accessibilityRole="header" style={[coralText.section, styles.flex, { color: c.ink }]}>
                    {evaluation.similarWardrobeItems.some((s) => s.likelyDuplicate) ? 'Parece que ya la tienes' : 'Ya tienes algo parecido'}
                  </Text>
                </View>
                {renderItemCards(evaluation.similarWardrobeItems)}
              </View>
            ) : null}

            {/* Criterio 3: prendas del armario con las que combina */}
            <View style={styles.matching}>
              <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                Prendas de tu armario con las que combina ({evaluation.matchingWardrobeItems.length})
              </Text>
              {evaluation.matchingWardrobeItems.length === 0 ? (
                <CoralCard radius={24} style={[styles.card, styles.centerItems]}>
                  <Shirt size={28} color={c.ink2} strokeWidth={2} />
                  <Text style={[coralText.strong, styles.center, { color: c.ink }]}>Sin prendas que combinen todavía</Text>
                  <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>
                    En tu armario no hay prendas que coordinen de inmediato con esta pieza. Para usarla, quizá necesites comprar algo más.
                  </Text>
                </CoralCard>
              ) : (
                renderItemCards(evaluation.matchingWardrobeItems)
              )}
            </View>

            {/* Recomendaciones de compra */}
            {evaluation.recommendationTips.length > 0 ? (
              <CoralCard radius={24} style={styles.card}>
                <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Recomendaciones de compra</Text>
                {evaluation.recommendationTips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Check size={16} color={c.ink} strokeWidth={2.4} style={styles.tipIcon} />
                    <Text style={[coralText.small, styles.flex, { color: c.ink2 }]}>{tip}</Text>
                  </View>
                ))}
              </CoralCard>
            ) : null}

            {/* Acciones */}
            <View style={styles.footer}>
              <CoralButton
                title="Agregar a mi armario"
                fullWidth
                loading={saving}
                accessibilityLabel="Agregar esta prenda a mi armario"
                onPress={() => { void handleConfirmSave(); }}
                leftIcon={<Shirt size={18} color={c.onPrimary} strokeWidth={2.2} />}
              />
              <CoralLink
                title="Evaluar otra prenda"
                underline
                disabled={saving}
                accessibilityLabel="Evaluar otra prenda de la tienda"
                onPress={handleReset}
                style={styles.centerSelf}
              />
            </View>
          </Appear>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centerSelf: { alignSelf: 'center' },
  centerItems: { alignItems: 'center' },
  content: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: '100%', aspectRatio: 3 / 4, maxHeight: 360, borderRadius: 24 },
  result: { gap: 14 },
  card: { gap: 10 },
  verdictHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18 },
  previewImage: { width: 64, height: 64, borderRadius: 14 },
  previewInfo: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  tagText: { fontFamily: coralFonts.bold },
  matching: { gap: 10 },
  matchList: { gap: 12, paddingVertical: 4, paddingHorizontal: 2 },
  matchCard: { width: 170, overflow: 'hidden' },
  matchImage: { width: '100%', height: 140, alignItems: 'center', justifyContent: 'center' },
  matchCopy: { padding: 10, gap: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipIcon: { marginTop: 2 },
  footer: { gap: 6, marginTop: 4 },
});
