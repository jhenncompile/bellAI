import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Check, CircleCheck, Shirt, TriangleAlert } from 'lucide-react-native';
import { Banner, Chip, ContentState, InputText, PageHeader, useNotice } from '@/shared/ui';
import { Appear, CoralButton, CoralCard, CoralLink, CoralScreen, Mascot, coralFonts, coralText, useCoral, useCoralFieldStyles } from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { compatibilityApi } from '@/features/bellai/api/bellaiApi';
import type { CompatibilityResult } from '@/features/bellai/api/types';
import { ScoreBar, SectionTitle, TrafficLight, WhyPanel } from '@/features/bellai/ui/components';
import { wardrobeService } from '@/features/digital-wardrobe/services/wardrobeService';
import {
  SUBCATEGORY_TO_CATEGORY,
  WARDROBE_OCCASIONS,
  WARDROBE_SUBCATEGORIES,
  type CaptureSource,
  type WardrobeCategory,
  type WardrobeOccasion,
  type WardrobeSubcategory,
} from '@/features/digital-wardrobe/types/wardrobe.types';
import { PhotoAnalysisConsentRequiredError } from '@/features/privacy/api/privacyService';

const OCCASIONS = ['Trabajo', 'Casual', 'Fiesta', 'Formal'];
const CATEGORIES: WardrobeCategory[] = ['superior', 'inferior', 'calzado', 'abrigo', 'accesorio'];

/** Nombre legible de la subcategoría que devuelve el análisis (llega como identificador). */
const SUBCATEGORY_LABEL: Record<string, string> = {
  blusas: 'Blusa', camisas: 'Camisa', camisetas: 'Camiseta', tops: 'Top', vestidos: 'Vestido',
  pantalones: 'Pantalón', jeans: 'Jean', faldas: 'Falda', shorts: 'Short', chaquetas: 'Chaqueta',
  abrigos: 'Abrigo', sueteres: 'Suéter', blazers: 'Blazer', zapatillas: 'Zapatillas', tacones: 'Tacones',
  botas: 'Botas', sandalias: 'Sandalias', bolsos: 'Bolso', cinturones: 'Cinturón', joyeria: 'Joyería',
  sombreros: 'Sombrero', bufandas: 'Bufanda', lentes: 'Lentes', relojes: 'Reloj', otros: 'Prenda',
};

function garmentLabel(slug: string): string {
  const key = slug.trim().toLowerCase();
  if (SUBCATEGORY_LABEL[key]) return SUBCATEGORY_LABEL[key];
  const text = key.replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Prenda';
}

/** Categoría y subcategoría válidas para el armario a partir del resultado. */
function wardrobeKind(g: CompatibilityResult['garment']): { category: WardrobeCategory; subcategory: WardrobeSubcategory } {
  const sub = g.subcategory.trim().toLowerCase();
  if ((WARDROBE_SUBCATEGORIES as readonly string[]).includes(sub)) {
    const subcategory = sub as WardrobeSubcategory;
    return { category: SUBCATEGORY_TO_CATEGORY[subcategory], subcategory };
  }
  const cat = g.category.trim().toLowerCase() as WardrobeCategory;
  return { category: CATEGORIES.includes(cat) ? cat : 'superior', subcategory: 'otros' };
}

type SaveProblem = { kind: 'consent' } | { kind: 'error'; message: string };

/** HU-024 / HU-025 / HU-027: ¿me compro esta prenda? Semáforo con los motivos. La foto no se guarda salvo que se agregue al armario. */
export const CompatibilityScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const { iconColor: _iconColor, ...field } = useCoralFieldStyles();
  const [photo, setPhoto] = useState<string | null>(null);
  const [source, setSource] = useState<CaptureSource>('camera');
  const [permissionDenied, setPermissionDenied] = useState<'camera' | 'gallery' | null>(null);
  const [occasion, setOccasion] = useState<string | undefined>();
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionDenied(camera ? 'camera' : 'gallery');
      return;
    }
    setPermissionDenied(null);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 5] };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]?.uri) {
      setPhoto(res.assets[0].uri);
      setSource(camera ? 'camera' : 'gallery');
      setResult(null);
      setError(null);
      setAdded(false);
      setSaveProblem(null);
    }
  };

  const evaluate = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    setAdded(false);
    setSaveProblem(null);
    try {
      const p = Number(price.replace(',', '.'));
      setResult(await compatibilityApi.evaluate(photo, { occasion, price: price && Number.isFinite(p) ? p : undefined }));
    } catch (err) {
      setError(friendlyMessage(err, 'Revisa tu conexión y vuelve a intentarlo. Si sigue igual, prueba con otra foto.'));
    } finally {
      setLoading(false);
    }
  };

  const addToWardrobe = async () => {
    if (!result || !photo) return;
    setAdding(true);
    setSaveProblem(null);
    try {
      const g = result.garment;
      const { category, subcategory } = wardrobeKind(g);
      const occ = occasion?.toLowerCase() as WardrobeOccasion | undefined;
      const response = await wardrobeService.scanAndSaveGarment({
        photoUri: photo,
        name: `${garmentLabel(g.subcategory)} ${g.color.toLowerCase()}`.trim(),
        category,
        subcategory,
        color: g.color,
        colorHex: g.colorHex || null,
        occasion: occ && WARDROBE_OCCASIONS.includes(occ) ? occ : undefined,
        captureSource: source,
      });
      setAdded(true);
      notify({
        kind: 'success',
        message: response.savedAsDraft ? 'Guardamos la prenda en tu armario sin conexión. Se sincroniza al volver la conexión.' : 'Prenda agregada a tu armario.',
        actionLabel: 'Ver',
        onAction: () => router.push('/wardrobe'),
      });
    } catch (err) {
      setSaveProblem(err instanceof PhotoAnalysisConsentRequiredError
        ? { kind: 'consent' }
        : { kind: 'error', message: friendlyMessage(err, 'No pudimos agregar la prenda. Inténtalo de nuevo.') });
    } finally {
      setAdding(false);
    }
  };

  const g = result?.garment;
  const pattern = g && g.pattern && g.pattern !== 'liso' ? `, estampado ${g.pattern.replace(/_/g, ' ')}` : '';
  const budget = result?.budget;
  const extraReasons = result ? result.reasons.filter((r) => !result.factors.some((f) => r.startsWith(f.factor))) : [];

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <PageHeader title="¿Me lo" titleAccent="compro?" compact onBack={() => router.back()} description="Fotografía una prenda en la tienda y te decimos si es para ti." />

      {photo ? (
        <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: c.muted }]} contentFit="cover" accessibilityLabel="Prenda a evaluar" />
      ) : (
        <ContentState
          icon={<Mascot pose="fotografo" height={130} enter="pop" />}
          title="Toma una foto de la prenda"
          description="Colócala sobre un fondo liso o tómala colgada. La foto se analiza y se descarta, salvo que la agregues a tu armario."
        />
      )}
      {/* Sistema P1: sin foto, «Tomar foto» es la acción principal; con foto, la principal es «Evaluar prenda». */}
      {photo ? (
        <View style={styles.row}>
          <CoralLink title="Tomar otra" underline onPress={() => void pick(true)} accessibilityLabel="Tomar otra foto de la prenda" />
          <CoralLink title="Elegir de la galería" underline onPress={() => void pick(false)} accessibilityLabel="Elegir otra foto de la galería" />
        </View>
      ) : (
        <View style={styles.pickActions}>
          <CoralButton title="Tomar foto" onPress={() => void pick(true)} leftIcon={<Camera size={18} color={c.onPrimary} strokeWidth={2.2} />} fullWidth />
          <CoralLink title="Elegir de la galería" underline onPress={() => void pick(false)} accessibilityLabel="Elegir una foto de la galería" />
        </View>
      )}
      {permissionDenied ? (
        <Banner
          kind="warning"
          title={permissionDenied === 'camera' ? 'Sin permiso para la cámara' : 'Sin permiso para tus fotos'}
          description={permissionDenied === 'camera' ? 'Actívalo en los ajustes del teléfono para fotografiar la prenda.' : 'Actívalo en los ajustes del teléfono para elegir una foto.'}
          actionLabel="Abrir ajustes"
          onAction={() => void Linking.openSettings()}
        />
      ) : null}

      <View>
        <SectionTitle>Ocasión (opcional)</SectionTitle>
        <View style={styles.wrap}>
          {OCCASIONS.map((o) => <Chip key={o} label={o} active={occasion === o} onPress={() => setOccasion(occasion === o ? undefined : o)} />)}
        </View>
      </View>
      <InputText
        label="Precio (opcional)"
        accessibilityLabel="Precio de la prenda"
        placeholder="Ej. 150"
        {...field}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />

      <CoralButton
        title={result ? 'Evaluar de nuevo' : 'Evaluar prenda'}
        variant={result ? 'secondary' : 'primary'}
        onPress={() => void evaluate()}
        loading={loading}
        disabled={!photo}
        fullWidth
        accessibilityHint={photo ? undefined : 'Primero toma o elige una foto'}
      />
      {error ? <Banner kind="error" title="No pudimos evaluar la prenda" description={error} actionLabel="Reintentar" onAction={() => void evaluate()} /> : null}

      {result && g ? (
        <Appear>
          <CoralCard radius={24} style={styles.card}>
            <TrafficLight light={result.light} />
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>{result.headline}</Text>
            <Text style={[coralText.body, { color: c.ink2 }]}>{result.recommendation}</Text>
            <View style={styles.detected}>
              {g.colorHex ? <View style={[styles.dot, { backgroundColor: g.colorHex, borderColor: c.fieldStroke }]} /> : null}
              <Text style={[coralText.small, styles.flex, { color: c.ink2 }]}>
                Detectamos: {garmentLabel(g.subcategory)} {g.color.toLowerCase()}{pattern}.
              </Text>
            </View>

            {budget && budget.price !== null ? (
              <View style={styles.detected}>
                {budget.withinBudget === true ? <CircleCheck size={18} color="#2F6B3F" strokeWidth={2.4} /> : null}
                {budget.withinBudget === false ? <TriangleAlert size={18} color="#8A5300" strokeWidth={2.4} /> : null}
                <Text style={[coralText.small, styles.flex, { color: c.ink }]}>
                  Precio: {budget.price}
                  {budget.limit !== null ? ` · tu presupuesto: ${budget.limit}` : ''}
                  {budget.withinBudget === true ? '. Dentro de tu presupuesto.' : budget.withinBudget === false ? '. Supera tu presupuesto.' : ''}
                </Text>
              </View>
            ) : null}

            <SectionTitle>Por qué</SectionTitle>
            {result.factors.map((f) => <ScoreBar key={f.factor} label={f.factor} value={f.score} detail={f.detail} />)}
            {extraReasons.map((r) => (
              <View key={r} style={styles.detected}>
                <TriangleAlert size={16} color="#8A5300" strokeWidth={2.3} />
                <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{r}</Text>
              </View>
            ))}

            {result.combinations.examples.length ? (
              <>
                <SectionTitle>Con lo que ya tienes</SectionTitle>
                {result.combinations.count > 0 ? (
                  <Text style={[coralText.small, { color: c.ink2 }]}>
                    Combina con {result.combinations.count} {result.combinations.count === 1 ? 'conjunto' : 'conjuntos'} de tu armario. Algunos ejemplos:
                  </Text>
                ) : null}
                {result.combinations.examples.map((ex, i) => (
                  <View key={i} style={styles.detected}>
                    <Shirt size={16} color={c.ink2} strokeWidth={2.2} />
                    <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{ex.items.map((it) => it.name ?? it.role).join(' + ')}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {result.similarItems.length ? (
              <>
                <SectionTitle>Ya tienes algo parecido</SectionTitle>
                {result.similarItems.map((s) => (
                  <View key={s.id} style={styles.detected} accessible accessibilityLabel={`Prenda parecida: ${s.name ?? 'sin nombre'}`}>
                    <View style={[styles.dot, { backgroundColor: s.colorHex ?? c.muted, borderColor: c.fieldStroke }]} />
                    <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{s.name ?? 'Prenda sin nombre'}</Text>
                  </View>
                ))}
              </>
            ) : null}

            <WhyPanel
              label="¿Cómo lo calculamos?"
              explanation={result.factors.map((f) => ({ factor: f.factor, value: `${Math.round(f.score * 100)}/100`, rule: f.detail }))}
              kind="compatibilidad"
              data={{ light: result.light, factors: result.factors, reasons: result.reasons }}
            />

            {result.light !== 'rojo' ? (
              <View style={styles.addBlock}>
                {saveProblem?.kind === 'consent' ? (
                  <Banner
                    kind="warning"
                    title="Falta tu autorización para fotos"
                    description="Para guardar la foto en tu armario, autoriza el análisis de fotografías en tu perfil."
                    actionLabel="Ir a mi perfil"
                    onAction={() => router.push('/profile')}
                  />
                ) : saveProblem?.kind === 'error' ? (
                  <Banner kind="error" title="No pudimos agregar la prenda" description={saveProblem.message} actionLabel="Reintentar" onAction={() => void addToWardrobe()} />
                ) : null}
                <CoralButton
                  title={added ? 'Ya está en tu armario' : 'Agregar a mi armario'}
                  fullWidth
                  loading={adding}
                  disabled={added}
                  leftIcon={added ? <Check size={18} color={c.onPrimary} strokeWidth={2.4} /> : <Shirt size={18} color={c.onPrimary} strokeWidth={2.2} />}
                  onPress={() => void addToWardrobe()}
                />
                <Text style={[coralText.caption, styles.center, { color: c.ink2, fontFamily: coralFonts.semibold }]}>
                  Se guarda con esta foto para usarla en tus outfits.
                </Text>
              </View>
            ) : null}
          </CoralCard>
        </Appear>
      ) : null}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  pickActions: { gap: 4, alignItems: 'center' },
  content: { gap: 14 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 24 },
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 10 },
  detected: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  addBlock: { gap: 10, marginTop: 6 },
});
