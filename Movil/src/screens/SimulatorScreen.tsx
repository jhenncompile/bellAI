import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Camera, ImageIcon, Star } from 'lucide-react-native';
import { Banner, Chip, ContentState, ProgressBar } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralLink,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import { simulationsApi } from '@/features/bellai/api/bellaiApi';
import type { SimulationKind, SimulationOptions, SimulationResult, Swatch } from '@/features/bellai/api/types';
import { useTask } from '@/features/bellai/model/useTask';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';

const KINDS: { kind: SimulationKind; label: string; hint: string }[] = [
  { kind: 'color_cabello', label: 'Cabello', hint: 'Foto con el cabello suelto y visible.' },
  { kind: 'maquillaje', label: 'Maquillaje', hint: 'Foto de frente, con buena luz.' },
  { kind: 'gafas', label: 'Gafas', hint: 'Foto de frente, sin gafas puestas.' },
  { kind: 'unas', label: 'Uñas', hint: 'Foto de tu mano abierta, uñas visibles.' },
  { kind: 'prenda', label: 'Prendas', hint: 'Foto de frente, de cuerpo entero o de medio cuerpo, con los brazos a los lados.' },
];

// '#00000000' (transparente) significa «sin producto»
const NONE = '#00000000';
const BLUSH: Swatch[] = [{ name: 'Sin rubor', hex: NONE }, { name: 'Melocotón', hex: '#F4A6A0' }, { name: 'Rosa', hex: '#E8899F' }, { name: 'Terracota', hex: '#C9805F' }];
const EYESHADOW: Swatch[] = [{ name: 'Sin sombra', hex: NONE }, { name: 'Café', hex: '#6B4F3A' }, { name: 'Bronce', hex: '#9C6B3C' }, { name: 'Malva', hex: '#8E6A8A' }];

/** ¿El nombre del color coincide con alguno de los recomendados por el análisis? */
const isFavored = (name: string, favored?: string[]) =>
  Boolean(favored?.some((f) => f.trim().toLowerCase() === name.trim().toLowerCase()));

/** Muestras de color con nombre. Las que te favorecen llevan estrella y texto (no solo color). */
function SwatchPicker({ colors: list, value, onChange, label, favored }: {
  colors: Swatch[]; value?: string; onChange: (hex: string) => void; label: string; favored?: string[];
}) {
  const c = useCoral();
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {list.map((s) => {
        const on = value === s.hex;
        const fav = isFavored(s.name, favored);
        return (
          <Pressable
            key={s.hex + s.name}
            accessibilityRole="radio"
            accessibilityLabel={`${s.name}${fav ? ', te favorece' : ''}`}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(s.hex)}
            style={({ pressed }) => [styles.swatchCell, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.swatchRing, { borderColor: on ? c.ink : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: s.hex === NONE ? c.muted : s.hex, borderColor: c.fieldStroke }]}>
                {s.hex === NONE ? <Ban size={20} color={c.ink2} /> : null}
              </View>
              {fav ? (
                <View style={[styles.favDot, { backgroundColor: c.card }]}>
                  <Star size={12} color={c.ink} fill={c.ink} />
                </View>
              ) : null}
            </View>
            <Text numberOfLines={2} style={[coralText.caption, styles.center, { color: on ? c.ink : c.ink2, fontFamily: on ? coralFonts.extrabold : coralFonts.semibold }]}>
              {s.name}
            </Text>
            {fav ? <Text style={[styles.favLabel, { color: c.ink }]}>Te favorece</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Encabezado de un paso del probador. */
function StepHead({ n, title }: { n: number; title: string }) {
  const c = useCoral();
  return (
    <View style={styles.stepHead}>
      <View style={[styles.stepNum, { backgroundColor: c.muted }]}>
        <Text style={[coralText.label, { color: c.ink }]}>{n}</Text>
      </View>
      <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>{title}</Text>
    </View>
  );
}

function SubTitle({ children }: { children: string }) {
  const c = useCoral();
  return <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>{children}</Text>;
}

/** Opciones iniciales de cada modalidad. */
function defaultChoice(k: SimulationKind): Record<string, any> {
  if (k === 'color_cabello') return { color: '#8E4A2B', style: 'completo' };
  if (k === 'maquillaje') return { lips: '#B3122E' };
  if (k === 'gafas') return { style: 'rectangulares', color: '#1A1A1A' };
  if (k === 'prenda') return {};
  return { color: '#C62828' };
}

/** HU-019 (cabello), HU-020 (maquillaje y uñas), HU-021 (gafas) sobre la foto de la usuaria. */
export const SimulatorScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  // Se puede abrir directamente en una modalidad (p. ej. desde el estudio: /simulator?kind=prenda)
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const initialKind = KINDS.find((k) => k.kind === kindParam)?.kind ?? 'color_cabello';
  const [kind, setKind] = useState<SimulationKind>(initialKind);
  const [opts, setOpts] = useState<SimulationOptions | null>(null);
  const [optsError, setOptsError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  // Foto guardada del análisis de rostro, si existe en este teléfono.
  const [analysisPhoto, setAnalysisPhoto] = useState<string | null>(null);
  // Muestra las opciones para cambiar la foto (ocultas mientras se usa la del análisis).
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [choice, setChoice] = useState<Record<string, any>>(() => defaultChoice(initialKind));
  const [startError, setStartError] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [permission, setPermission] = useState<{ camera: boolean; canAskAgain: boolean } | null>(null);
  const task = useTask<SimulationResult>();

  const loadOptions = useCallback(() => {
    simulationsApi.options().then(setOpts).catch((e) => setOptsError(friendlyMessage(e, 'No pudimos cargar los colores y estilos.')));
  }, []);

  useEffect(() => {
    loadOptions();
    MediaVaultService.getItemsByFolder('rostro').then((items) => {
      const uri = items[0]?.localUri;
      if (!uri) return;
      setAnalysisPhoto(uri);
      // Como antes: si hay foto del análisis, se carga sola para ir directo al cambio.
      setPhoto((current) => current ?? uri);
    }).catch(() => undefined);
  }, [loadOptions]);

  const selectKind = (k: SimulationKind) => {
    setKind(k);
    task.reset();
    setStartError(null);
    setChoice(defaultChoice(k));
  };

  const choosePhoto = (uri: string) => {
    setPhoto(uri);
    setChangingPhoto(false);
    setStartError(null);
    task.reset();
  };

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermission({ camera, canAskAgain: perm.canAskAgain });
      return;
    }
    setPermission(null);
    const o: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    const res = camera ? await ImagePicker.launchCameraAsync(o) : await ImagePicker.launchImageLibraryAsync(o);
    if (!res.canceled && res.assets[0]?.uri) choosePhoto(res.assets[0].uri);
  };

  // Si el sistema ya no deja volver a preguntar, el permiso se da desde los ajustes.
  const grantPermission = () => {
    if (!permission) return;
    if (permission.canAskAgain) void pick(permission.camera);
    else void Linking.openSettings();
  };

  const run = async () => {
    if (!photo) return;
    setStartError(null);
    setShowBefore(false);
    try {
      task.track(await simulationsApi.start(photo, kind, choice));
    } catch (err) {
      setStartError(friendlyMessage(err, 'No pudimos iniciar la simulación.'));
    }
  };

  const result = task.result;
  const hint = KINDS.find((k) => k.kind === kind)?.hint;
  // Qué falta para poder aplicar (se dice en texto, no solo con el botón apagado).
  const missing = !photo
    ? 'Primero elige una foto en el paso 1.'
    : kind === 'prenda' && !choice.garmentId
      ? 'Elige una prenda de tu armario en el paso 2.'
      : null;
  // El error de la tarea fallida puede venir en lenguaje técnico: se muestra un texto propio.
  const failure = startError
    ?? (task.task?.status === 'fallida' ? 'La simulación no terminó. Prueba con otra foto o vuelve a intentarlo.' : task.failure);
  const shownUri = result && !showBefore ? `data:${result.mime};base64,${result.imageBase64}` : photo;

  return (
    <CoralScreen withTabBar contentStyle={styles.content}>
      <View style={styles.header}>
        <CoralBackButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <CoralTitle prefix="Probador " accent="virtual" size={28} />
        </View>
      </View>
      <Text style={[coralText.small, { color: c.ink2 }]}>Prueba cambios antes de hacerlos en la vida real.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {KINDS.map((k) => (
          <Chip key={k.kind} label={k.label} active={kind === k.kind} onPress={() => selectKind(k.kind)} accessibilityLabel={`Probar ${k.label.toLowerCase()}${kind === k.kind ? ', seleccionado' : ''}`} />
        ))}
      </ScrollView>

      {permission ? (
        <Banner
          kind="warning"
          title={permission.camera ? 'Falta permiso para usar la cámara' : 'Falta permiso para ver tus fotos'}
          description={permission.canAskAgain ? 'Lo necesitamos para usar tu foto en el probador.' : 'Actívalo en los ajustes del teléfono para usar tu foto en el probador.'}
          actionLabel="Dar permiso"
          onAction={grantPermission}
        />
      ) : null}

      {/* Paso 1: la foto (y el resultado sobre ella) */}
      <Appear>
        <CoralCard radius={24} style={styles.gap}>
          <StepHead n={1} title={result ? 'Tu resultado' : 'Elige tu foto'} />
          {!photo ? (
            <View style={styles.pickBox}>
              <Mascot pose="fotografo" height={130} enter="pop" />
              {hint ? <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>{hint}</Text> : null}
              <CoralButton title="Tomar foto" height={44} onPress={() => void pick(true)} leftIcon={<Camera size={18} color={c.onPrimary} />} fullWidth />
              {analysisPhoto ? (
                <CoralButton title="Usar mi foto del análisis" variant="secondary" height={44} onPress={() => choosePhoto(analysisPhoto)} leftIcon={<ImageIcon size={18} color={c.ink} />} fullWidth />
              ) : null}
              <CoralLink title="Elegir de la galería" underline onPress={() => void pick(false)} accessibilityLabel="Elegir una foto de la galería" />
            </View>
          ) : (
            <>
              {result ? (
                <View style={[styles.segment, { backgroundColor: c.muted }]} accessibilityRole="tablist">
                  {[{ label: 'Antes', before: true }, { label: 'Después', before: false }].map(({ label, before }) => {
                    const on = showBefore === before;
                    return (
                      <Pressable
                        key={label}
                        accessibilityRole="tab"
                        accessibilityLabel={before ? 'Ver la foto original' : 'Ver la foto con el cambio'}
                        accessibilityState={{ selected: on }}
                        onPress={() => setShowBefore(before)}
                        style={[styles.segItem, on && { backgroundColor: c.card }]}
                      >
                        <Text style={[coralText.label, { color: on ? c.ink : c.ink2, fontFamily: on ? coralFonts.extrabold : coralFonts.semibold }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <View>
                <Image
                  source={{ uri: shownUri ?? undefined }}
                  style={styles.photo}
                  contentFit="cover"
                  accessibilityLabel={result ? (showBefore ? 'Tu foto original' : 'Tu foto con el cambio aplicado') : 'Foto elegida'}
                />
                {result ? (
                  <View style={[styles.photoTag, { backgroundColor: c.card }]}>
                    <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: c.ink }]}>{showBefore ? 'Antes' : 'Después'}</Text>
                  </View>
                ) : null}
              </View>
              {result ? (
                <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>
                  Simulación aproximada sobre tu foto. {result.saved ? 'Se guardó en tu historial.' : 'No se guardó la foto; puedes activar «Conservar mis fotos» en Privacidad.'}
                </Text>
              ) : hint ? <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{hint}</Text> : null}
              {photo === analysisPhoto && !changingPhoto ? (
                <View style={styles.photoActions}>
                  <Text style={[coralText.caption, styles.flex, { fontSize: 13, fontFamily: coralFonts.bold, color: c.ink }]}>Usando tu foto del análisis</Text>
                  <CoralLink title="Cambiar foto" underline onPress={() => setChangingPhoto(true)} accessibilityHint="Toma otra foto o elige una de la galería" disabled={task.running} />
                </View>
              ) : (
                <View style={styles.photoActions}>
                  <CoralLink title="Tomar otra" underline onPress={() => void pick(true)} accessibilityLabel="Tomar otra foto" disabled={task.running} />
                  <CoralLink title="Elegir de la galería" underline onPress={() => void pick(false)} accessibilityLabel="Elegir otra foto de la galería" disabled={task.running} />
                  {analysisPhoto && photo !== analysisPhoto ? (
                    <CoralLink title="Usar mi foto del análisis" underline onPress={() => choosePhoto(analysisPhoto)} disabled={task.running} />
                  ) : null}
                </View>
              )}
            </>
          )}
        </CoralCard>
      </Appear>

      {/* Paso 2: opciones del tipo elegido */}
      <Appear delay={100}>
        <CoralCard radius={24} style={styles.gap}>
          <StepHead n={2} title="Elige el cambio" />
          {optsError ? (
            <Banner kind="error" title="No pudimos cargar las opciones" description={optsError} actionLabel="Reintentar" onAction={() => { setOptsError(null); loadOptions(); }} />
          ) : !opts ? (
            <Text accessibilityLiveRegion="polite" style={[coralText.small, { color: c.ink2 }]}>Cargando colores y estilos…</Text>
          ) : null}

          {opts && kind === 'color_cabello' ? (
            <>
              <SubTitle>Color</SubTitle>
              {opts.hair.recommendedShades.length ? (
                <View style={[styles.favBox, { backgroundColor: c.muted }]}>
                  <Star size={16} color={c.ink} fill={c.ink} />
                  <Text style={[coralText.small, styles.flex, { color: c.ink }]}>
                    <Text style={{ fontFamily: coralFonts.extrabold }}>Te favorecen: </Text>
                    {opts.hair.recommendedShades.join(', ')}
                  </Text>
                </View>
              ) : null}
              <SwatchPicker label="Color de cabello" colors={opts.hair.colors} favored={opts.hair.recommendedShades} value={choice.color} onChange={(color) => setChoice((p) => ({ ...p, color }))} />
              <SubTitle>Técnica</SubTitle>
              <View style={styles.wrap}>
                {opts.hair.styles.map((s) => <Chip key={s} label={s === 'completo' ? 'Tinte completo' : s === 'balayage' ? 'Balayage' : 'Mechas'} active={choice.style === s} onPress={() => setChoice((p) => ({ ...p, style: s }))} />)}
              </View>
            </>
          ) : null}
          {opts && kind === 'maquillaje' ? (
            <>
              <SubTitle>Labial</SubTitle>
              <SwatchPicker label="Labial" colors={opts.makeup.lips} favored={opts.makeup.recommendedLipsticks} value={choice.lips} onChange={(lips) => setChoice((p) => ({ ...p, lips }))} />
              <SubTitle>Rubor</SubTitle>
              <SwatchPicker label="Rubor" colors={BLUSH} value={choice.blush ?? NONE} onChange={(blush) => setChoice((p) => ({ ...p, blush: blush.length === 7 ? blush : undefined }))} />
              <SubTitle>Sombra de ojos</SubTitle>
              <SwatchPicker label="Sombra de ojos" colors={EYESHADOW} value={choice.eyeshadow ?? NONE} onChange={(eyeshadow) => setChoice((p) => ({ ...p, eyeshadow: eyeshadow.length === 7 ? eyeshadow : undefined }))} />
            </>
          ) : null}
          {opts && kind === 'gafas' ? (
            <>
              <SubTitle>Montura</SubTitle>
              <View style={styles.wrap}>
                {opts.glasses.styles.map((g) => (
                  <Chip
                    key={g.style}
                    label={g.recommended ? `${g.style} · Te favorece` : g.style}
                    icon={g.recommended ? <Star size={14} color={c.ink} fill={c.ink} /> : undefined}
                    accessibilityLabel={`${g.style}${g.recommended ? ', te favorece' : ''}`}
                    active={choice.style === g.style}
                    onPress={() => setChoice((p) => ({ ...p, style: g.style }))}
                  />
                ))}
              </View>
              {opts.glasses.reason ? <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{opts.glasses.reason}</Text> : null}
              <SubTitle>Color de la montura</SubTitle>
              <SwatchPicker label="Color de montura" colors={opts.glasses.frameColors} value={choice.color} onChange={(color) => setChoice((p) => ({ ...p, color }))} />
            </>
          ) : null}
          {opts && kind === 'unas' ? (
            <>
              <SubTitle>Esmalte</SubTitle>
              <SwatchPicker label="Esmalte" colors={opts.nails.colors} value={choice.color} onChange={(color) => setChoice((p) => ({ ...p, color }))} />
            </>
          ) : null}
          {opts && kind === 'prenda' ? (
            <>
              <SubTitle>Prenda de tu armario</SubTitle>
              {opts.garment?.items.length ? (
                <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Prenda para probar">
                  {opts.garment.items.map((g) => {
                    const active = choice.garmentId === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        accessibilityLabel={g.name ?? 'Prenda sin nombre'}
                        onPress={() => setChoice({ garmentId: g.id })}
                        style={[styles.garmentCell, { borderColor: active ? c.ink : c.fieldStroke }]}
                      >
                        <Image source={{ uri: EnvConfig.resolveImageUrl(g.imageUrl) ?? undefined }} style={styles.garmentImg} contentFit="cover" />
                        <Text numberOfLines={1} style={[coralText.caption, { color: active ? c.ink : c.ink2 }]}>{g.name ?? 'Prenda'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <ContentState kind="empty" title="Aún no hay prendas para probar" description="Agrega a tu armario prendas superiores, inferiores, abrigos o vestidos con foto." actionLabel="Ir al armario" onAction={() => router.push('/wardrobe')} />
              )}
              {opts.garment?.note ? <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{opts.garment.note}</Text> : null}
            </>
          ) : null}
        </CoralCard>
      </Appear>

      <View style={styles.gap}>
        <CoralButton
          title={result ? 'Aplicar de nuevo' : 'Aplicar'}
          onPress={() => void run()}
          loading={task.running}
          disabled={Boolean(missing) || task.running}
          accessibilityHint={missing ?? undefined}
          fullWidth
        />
        {missing && !task.running ? (
          <Text accessibilityLiveRegion="polite" style={[coralText.small, styles.center, { color: c.ink2 }]}>{missing}</Text>
        ) : null}
      </View>

      {task.running ? (
        <View style={styles.gap}>
          <ContentState kind="thinking" title="Aplicando el cambio" description={`Lo estamos dibujando sobre tu foto · ${Math.round(task.progress)} %`} />
          <ProgressBar progress={task.progress} />
        </View>
      ) : null}
      {failure && !task.running ? (
        <Banner kind="error" title="No pudimos simular" description={failure} actionLabel="Reintentar" onAction={task.task && !startError ? () => void task.retry() : () => void run()} />
      ) : null}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 14 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabsBar: { flexGrow: 0, marginHorizontal: -16 },
  tabs: { gap: 8, paddingHorizontal: 16 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pickBox: { alignItems: 'center', gap: 10 },
  segment: { flexDirection: 'row', borderRadius: 22, padding: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: 18 },
  photoTag: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, minHeight: 28, borderRadius: 14, justifyContent: 'center' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
  favBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchCell: { width: 72, alignItems: 'center', gap: 4, minHeight: 44 },
  swatchRing: { padding: 3, borderRadius: 28, borderWidth: 2 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  favDot: { position: 'absolute', right: -4, top: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(179, 57, 46, 0.2)' },
  favLabel: { fontFamily: coralFonts.extrabold, fontSize: 11, lineHeight: 14 },
  garmentCell: { width: 88, minHeight: 44, alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 18, padding: 4 },
  garmentImg: { width: 76, height: 76, borderRadius: 14 },
});
