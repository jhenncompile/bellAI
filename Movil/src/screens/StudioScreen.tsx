import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowRight,
  Camera,
  ChevronRight,
  CircleCheck,
  Palette,
  RefreshCcw,
  ScanFace,
  Shirt,
  Sparkles,
  Sun,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react-native';
import { Banner, Chip, ContentState } from '@/shared/ui';
import { VirtualDrapingStudio } from '@/widgets/VirtualDrapingStudio/ui/VirtualDrapingStudio';
import {
  Appear,
  CoralButton,
  CoralCard,
  CoralHero,
  CoralIconBox,
  CoralLink,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { componentSizes } from '@/shared/theme/tokens/spacing';
import { seasonTitleParts, toneSummary } from '@/entities/diagnostic/model/labels';
import type { ColorSwatch as Swatch, ContrastLevel, Undertone } from '@/entities/diagnostic/model/types';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { FaceGeometryVisualizer } from '@/widgets/FaceGeometryVisualizer/ui/FaceGeometryVisualizer';
import {
  buildLocalRecommendationReason,
  gatherFullUserContext,
} from '@/features/bellai/model/userContextAggregator';
import { bellaiService } from '@/features/bellai/api/bellaiService';
import type { ConsideredFactorItem } from '@/features/bellai/storage/bellaiHistoryStorage';
import { RecommendationReasonModal } from '@/widgets/RecommendationReason/RecommendationReasonModal';

/**
 * Mi análisis (Penpot «Flujo 02 · Análisis (P1)», pantallas B1 a B5 y B2b).
 * Pestañas: resumen, tono y subtono (HU-09), paleta (HU-10), rostro y silueta.
 */
const sections = [
  { key: 'summary', label: 'Resumen' },
  { key: 'tone', label: 'Tono' },
  { key: 'palette', label: 'Paleta' },
  { key: 'face', label: 'Rostro' },
  { key: 'silhouette', label: 'Silueta' },
  // Del Líder («fix models»): drapeado de telas, probador y maquillaje con IA.
  { key: 'simulation', label: 'Probador e IA' },
] as const;
type Section = typeof sections[number]['key'];

/** Rampa de tonos de piel, de claro a profundo (la misma de `colors.skinRamp`). */
const SKIN_RAMP = ['#F6E0D2', '#E9C4A5', '#CFA07A', '#A8744F', '#7A4B33', '#4B2C20'] as const;
/** Debajo de este valor el resultado es provisional y se pide otra foto (HU-09, criterio 2). */
const LOW_CONFIDENCE = 0.5;

/** Posición aproximada del tono en la rampa a partir del texto del análisis. */
function skinToneIndex(skinTone: string): number | null {
  const t = skinTone.toLowerCase();
  if (/muy oscur|profund/.test(t)) return 5;
  if (/oscur/.test(t)) return 4;
  if (/trigue|moren|oliv/.test(t)) return 3;
  if (/medi/.test(t)) return 2;
  if (/muy clar/.test(t)) return 0;
  if (/clar/.test(t)) return 1;
  return null;
}

const UNDERTONE_COPY: Record<Undertone, string> = {
  Calido: 'Tu piel tiene un fondo dorado. Los colores tierra y el oro te iluminan; los azules fríos te apagan.',
  Frio: 'Tu piel tiene un fondo rosado o azulado. Los tonos joya y la plata te favorecen; los naranjas te apagan.',
  Neutro: 'Tu piel equilibra cálido y frío. Puedes usar casi todos los colores; los muy saturados, con medida.',
};

const CONTRAST_COPY: Record<ContrastLevel, { value: number; tip: string }> = {
  Bajo: { value: 0.3, tip: 'Combina tonos cercanos entre sí; evita los contrastes fuertes.' },
  Medio: { value: 0.55, tip: 'Combina un tono claro con uno medio; evita el blanco con negro.' },
  Alto: { value: 0.85, tip: 'Te favorecen los contrastes marcados, como claro con oscuro.' },
};

const PALETTE_GROUPS: { key: Swatch['category']; title: string; hint: string }[] = [
  { key: 'base', title: 'Base', hint: 'Para tus prendas principales' },
  { key: 'acento', title: 'Acento', hint: 'Un toque de color' },
  { key: 'neutro', title: 'Neutros', hint: 'Para combinar todo' },
];

const confidenceLabel = (v: number) => (v >= 0.75 ? 'Alta' : v >= LOW_CONFIDENCE ? 'Media' : 'Baja');

export const StudioScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('summary');
  const [reasonModal, setReasonModal] = useState<{
    visible: boolean;
    title: string;
    reasonSummary: string;
    consideredFactors: ConsideredFactorItem[];
    contextSummary: string;
  }>({ visible: false, title: '', reasonSummary: '', consideredFactors: [], contextSummary: '' });

  const { currentDiagnostic: diagnostic, integratedDiagnosis, isRestoring, restoreError, reloadDiagnostic, clearRestoreError, loadSampleDiagnostic, pickFromGallery } = useScanWorkflow();
  const isSample = Boolean(diagnostic?.id?.startsWith('diag-sample'));
  // Abre la cámara guiada de Inicio directamente (A3), en modo rostro o cuerpo.
  const goToCapture = (mode: 'face' | 'body' = 'face') => router.push({ pathname: '/', params: { capture: mode } });
  const season = diagnostic ? seasonTitleParts(diagnostic.season) : null;
  const silhouettePending = !diagnostic?.bodyType || diagnostic.bodyType === 'Pendiente de escaneo corporal';
  // Confianza real del backend (colorimetría). Si el análisis fue local no hay dato y no se muestra.
  const confidence = integratedDiagnosis?.confidence?.colorimetry ?? integratedDiagnosis?.confidence?.overall ?? null;
  const lowConfidence = confidence !== null && confidence < LOW_CONFIDENCE;

  const openReasonFor = async (title: string) => {
    const ctx = await gatherFullUserContext(diagnostic);
    const localReason = buildLocalRecommendationReason(ctx, { title, category: 'general' });
    const remote = await bellaiService.explainRecommendation({ recommendationType: 'general', title });
    setReasonModal({
      visible: true,
      title,
      reasonSummary: remote?.reasonSummary || localReason.reasonSummary,
      consideredFactors: remote?.consideredFactors?.length ? remote.consideredFactors : localReason.consideredFactors,
      contextSummary: localReason.contextBadgeText,
    });
  };
  const why = (title: string) => (
    <CoralLink title="¿Por qué?" underline onPress={() => { void openReasonFor(title); }} accessibilityLabel={`Por qué: ${title}`} style={styles.why} />
  );

  const ConfidenceCard = () => (confidence === null ? null : (
    <CoralCard radius={24} style={styles.gap}>
      <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Qué tan seguro es</Text>
      <Meter
        label="Colorimetría"
        value={confidence}
        valueLabel={`${confidenceLabel(confidence)} · ${Math.round(confidence * 100)} %`}
        warn={lowConfidence}
      />
    </CoralCard>
  ));

  const renderSummary = () => {
    if (!diagnostic || !season) return null;
    const rows: { Icon: LucideIcon; title: string; detail: string; tile: number; target: Section; pending?: boolean }[] = [
      { Icon: ScanFace, title: 'Tono y subtono', detail: `${diagnostic.skinTone} · ${toneSummary(diagnostic.undertone, diagnostic.contrastLevel).split(' · ')[0].replace('Subtono ', '')}`, tile: 0, target: 'tone' },
      { Icon: Palette, title: 'Tu paleta', detail: `${diagnostic.palette.length} colores${diagnostic.toxicColors?.length ? ` · ${diagnostic.toxicColors.length} a evitar` : ''}`, tile: 1, target: 'palette' },
      { Icon: UserRound, title: 'Rostro', detail: diagnostic.faceShape, tile: 2, target: 'face' },
      { Icon: Shirt, title: 'Silueta', detail: silhouettePending ? 'Falta foto de cuerpo' : String(diagnostic.bodyType), tile: 3, target: 'silhouette', pending: silhouettePending },
    ];
    return <>
      <Appear>
        <CoralHero style={styles.hero} glow={{ right: -30, top: -40, size: 220 }} accessibilityLabel={`Tu estación: ${season.lead}${season.accent}`}>
          <Text style={[coralText.caption, styles.eyebrow, { color: c.heroInk }]}>TU ESTACIÓN</Text>
          <CoralTitle prefix={season.lead} accent={season.accent} size={32} color={c.heroInk} accentColor={c.heroInk} />
          <Text style={[coralText.label, { color: c.heroInk }]}>{toneSummary(diagnostic.undertone, diagnostic.contrastLevel)}</Text>
          <View style={styles.swatches}>
            {diagnostic.palette.slice(0, 5).map((s, i) => (
              <View key={s.hex + s.name} accessible accessibilityLabel={s.name} style={[styles.swatch, { backgroundColor: s.hex, marginLeft: i ? -10 : 0 }]} />
            ))}
          </View>
          <View style={styles.heroFoot}>
            {confidence !== null ? (
              <View style={[styles.badge, { backgroundColor: '#FFFFFF' }]}>
                {lowConfidence ? <TriangleAlert size={15} color="#8A5300" strokeWidth={2.4} /> : <CircleCheck size={15} color="#2F6B3F" strokeWidth={2.4} />}
                <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: lowConfidence ? '#8A5300' : '#2F6B3F' }]}>
                  Confianza {confidenceLabel(confidence).toLowerCase()} · {Math.round(confidence * 100)} %
                </Text>
              </View>
            ) : <View />}
            {why(`Diagnóstico ${diagnostic.season}`)}
          </View>
        </CoralHero>
      </Appear>
      <Appear delay={120} style={styles.gap}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Tus resultados</Text>
        <CoralCard radius={24} padding={0} style={styles.list}>
          {rows.map((r, i) => (
            <Pressable
              key={r.title}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}: ${r.detail}${r.pending ? ', pendiente' : ''}`}
              onPress={() => setSection(r.target)}
              style={({ pressed }) => [styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }, pressed && { opacity: 0.7 }]}
            >
              <CoralIconBox gradient={c.tiles[r.tile]}><r.Icon size={22} color="#2A1714" strokeWidth={2.2} /></CoralIconBox>
              <View style={styles.rowCopy}>
                <Text style={[coralText.strong, { color: c.ink }]}>{r.title}</Text>
                <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]} numberOfLines={1}>{r.detail}</Text>
              </View>
              {r.pending ? (
                <View style={[styles.pending, { backgroundColor: '#FFF1D6' }]}>
                  <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: '#8A5300' }]}>Pendiente</Text>
                </View>
              ) : <ChevronRight size={22} color={c.ink2} />}
            </Pressable>
          ))}
        </CoralCard>
      </Appear>
    </>;
  };

  const renderTone = () => {
    if (!diagnostic) return null;
    const idx = skinToneIndex(diagnostic.skinTone);
    const contrast = CONTRAST_COPY[diagnostic.contrastLevel] ?? CONTRAST_COPY.Medio;
    const undertones: Undertone[] = ['Frio', 'Neutro', 'Calido'];
    if (lowConfidence) {
      return <>
        <Appear>
          <View style={[styles.lowBox, { backgroundColor: '#FFF1D6', borderColor: '#8A5300' }]} accessibilityRole="alert">
            <View style={styles.lowTop}>
              <Mascot pose="senalando" height={96} enter="pop" />
              <View style={styles.flex}>
                <Text accessibilityRole="header" style={[styles.lowTitle, { color: c.ink }]}>Necesitamos otra foto</Text>
                <Text style={[coralText.small, { color: c.ink2 }]}>La luz no permitió medir bien tu tono. Con luz natural el resultado será confiable.</Text>
              </View>
            </View>
            <CoralButton title="Tomar otra foto" height={44} onPress={() => goToCapture()} leftIcon={<Camera size={18} color={c.onPrimary} />} fullWidth />
          </View>
        </Appear>
        <CoralCard radius={24} style={[styles.gap, { opacity: 0.7 }]}>
          <Text style={[coralText.strong, { color: c.ink }]}>Resultado provisional</Text>
          <Text style={[styles.toneValue, { color: c.ink, fontSize: 20 }]}>{diagnostic.skinTone} · subtono {toneSummary(diagnostic.undertone, diagnostic.contrastLevel).split(' · ')[0].replace('Subtono ', '')}</Text>
          <SkinRamp index={idx} />
        </CoralCard>
        <ConfidenceCard />
      </>;
    }
    return <>
      <Appear>
        <CoralCard radius={24} style={styles.gap}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Tu tono de piel</Text>
            {why('Tono de piel')}
          </View>
          <Text style={[styles.toneValue, { color: c.ink }]}>{diagnostic.skinTone}</Text>
          <SkinRamp index={idx} />
        </CoralCard>
      </Appear>
      <Appear delay={100}>
        <CoralCard radius={24} style={styles.gap}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Subtono</Text>
            {why('Subtono de piel')}
          </View>
          <View style={[styles.segment, { backgroundColor: c.muted }]} accessible accessibilityLabel={`Subtono ${toneSummary(diagnostic.undertone, diagnostic.contrastLevel).split(' · ')[0].replace('Subtono ', '')}`}>
            {undertones.map((u) => {
              const on = u === diagnostic.undertone;
              const label = u === 'Frio' ? 'Frío' : u === 'Calido' ? 'Cálido' : 'Neutro';
              return (
                <View key={u} style={[styles.segItem, on && { backgroundColor: '#FFD5A1' }]}>
                  <Text style={[coralText.small, { fontFamily: on ? coralFonts.extrabold : coralFonts.semibold, color: on ? c.ink : c.ink2 }]}>{label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[coralText.small, { color: c.ink2 }]}>{UNDERTONE_COPY[diagnostic.undertone] ?? UNDERTONE_COPY.Neutro}</Text>
        </CoralCard>
      </Appear>
      <Appear delay={200}>
        <CoralCard radius={24} style={styles.gap}>
          <Meter label="Contraste" value={contrast.value} valueLabel={diagnostic.contrastLevel} strong />
          <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{contrast.tip}</Text>
        </CoralCard>
      </Appear>
      <Appear delay={300}><ConfidenceCard /></Appear>
      <View style={[styles.note, { backgroundColor: '#FFF1D6', borderColor: '#8A5300' }]}>
        <Sun size={20} color="#8A5300" strokeWidth={2.3} />
        <Text style={[coralText.caption, styles.flex, { fontSize: 13, fontFamily: coralFonts.bold, color: c.ink }]}>
          Si la luz era cálida o artificial, el subtono puede variar. Repite con luz natural para confirmarlo.
        </Text>
      </View>
      <CoralButton title="Ver mi paleta" onPress={() => setSection('palette')} rightIcon={<ArrowRight size={18} color={c.onPrimary} />} fullWidth />
    </>;
  };

  const renderPalette = () => {
    if (!diagnostic) return null;
    if (!diagnostic.palette.length) {
      return <ContentState kind="empty" title="Tu paleta todavía no está disponible" description="Vuelve a Inicio y prueba con una nueva fotografía." actionLabel="Tomar otra foto" onAction={() => goToCapture()} />;
    }
    return <>
      {PALETTE_GROUPS.map((g, gi) => {
        const items = diagnostic.palette.filter((s) => s.category === g.key);
        if (!items.length) return null;
        return (
          <Appear key={g.key} delay={gi * 100}>
            <CoralCard radius={24} style={styles.gap}>
              <View>
                <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>{g.title}</Text>
                <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{g.hint}</Text>
              </View>
              <View style={styles.paletteGrid}>
                {items.map((s) => (
                  <View key={s.hex + s.name} style={styles.paletteCell} accessible accessibilityLabel={`${s.name}${s.usageTip ? `. ${s.usageTip}` : ''}`}>
                    <View style={[styles.chipColor, { backgroundColor: s.hex, borderColor: c.fieldStroke }]} />
                    <Text style={[coralText.caption, styles.center, { color: c.ink2, fontFamily: coralFonts.bold }]} numberOfLines={1}>{s.name}</Text>
                  </View>
                ))}
              </View>
            </CoralCard>
          </Appear>
        );
      })}
      {diagnostic.toxicColors?.length ? (
        <Appear delay={300}>
          <CoralCard radius={24} style={styles.gap}>
            <View style={styles.cardHead}>
              <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Mejor evita</Text>
              {why('Colores a evitar')}
            </View>
            <View style={styles.avoidRow}>
              {diagnostic.toxicColors.slice(0, 4).map((t) => (
                <View key={t.hex + t.name} style={styles.avoidItem} accessible accessibilityLabel={`Evita ${t.name}: ${t.negativeEffect}`}>
                  <View style={[styles.avoidDot, { backgroundColor: t.hex }]}><X size={18} color="#FFFFFF" strokeWidth={3} /></View>
                  <View style={styles.flex}>
                    <Text style={[coralText.label, { color: c.ink }]}>{t.name}</Text>
                    <Text style={[coralText.caption, { color: c.ink2 }]} numberOfLines={2}>{t.negativeEffect}</Text>
                  </View>
                </View>
              ))}
            </View>
          </CoralCard>
        </Appear>
      ) : null}
      {diagnostic.recommendedMetals.length ? (
        <View style={styles.metals}>
          <Text style={[coralText.label, { color: c.ink }]}>Metales:</Text>
          {diagnostic.recommendedMetals.map((m) => <Chip key={m} label={m} icon={<Sparkles size={14} color={c.ink} />} />)}
        </View>
      ) : null}
      <CoralButton title="Probar en un outfit" onPress={() => router.push('/outfits' as never)} rightIcon={<ArrowRight size={18} color={c.onPrimary} />} fullWidth />
    </>;
  };

  const renderFace = () => {
    if (!diagnostic) return null;
    const groups = [
      { title: 'Cortes para explorar', items: diagnostic.hairAdvice.recommendedCuts },
      { title: 'Tonos de cabello', items: diagnostic.hairAdvice.recommendedShades },
      { title: 'Monturas de gafas', items: diagnostic.glassesAdvice.recommendedFrames },
    ].filter((g) => g.items.length);
    return <>
      <Appear>
        <CoralCard radius={24} style={styles.faceCard}>
          <View style={[styles.faceShape, { borderColor: '#FF6F61' }]} accessible={false} />
          <View style={styles.flex}>
            <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>Tu rostro es</Text>
            <Text accessibilityRole="header" style={[styles.toneValue, { color: c.ink }]}>{diagnostic.faceShape}</Text>
          </View>
        </CoralCard>
      </Appear>
      {diagnostic.realLandmarks ? <FaceGeometryVisualizer diagnostic={diagnostic} imageUri={diagnostic.imageUri} faceShape={diagnostic.faceShape} onTakeFacePhoto={() => goToCapture()} /> : null}
      {groups.map((g, i) => (
        <Appear key={g.title} delay={100 + i * 100}>
          <CoralCard radius={24} style={styles.gap}>
            <View style={styles.cardHead}>
              <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>{g.title}</Text>
              {why(g.title)}
            </View>
            <View style={styles.chips}>{g.items.map((it) => <Chip key={it} label={it} />)}</View>
          </CoralCard>
        </Appear>
      ))}
      {diagnostic.hairTexture ? (
        <Appear delay={100 + groups.length * 100}>
          <CoralCard radius={24} style={styles.gap}>
            <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Tu cabello</Text>
            <View style={styles.chips}><Chip label={`Textura ${diagnostic.hairTexture.type.toLowerCase()}`} /></View>
            {diagnostic.hairTexture.care.map((t) => <Tip key={t} Icon={CircleCheck} text={t} />)}
          </CoralCard>
        </Appear>
      ) : null}
      {diagnostic.beautyAdvice ? (
        <Appear delay={200 + groups.length * 100}>
          <CoralCard radius={24} style={styles.gap}>
            <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Maquillaje para tus rasgos</Text>
            {diagnostic.beautyAdvice.traits.length ? (
              <View style={styles.chips}>{diagnostic.beautyAdvice.traits.map((t) => <Chip key={t} label={t} />)}</View>
            ) : null}
            {diagnostic.beautyAdvice.makeupTips.map((t) => <Tip key={t} Icon={Sparkles} text={t} />)}
          </CoralCard>
        </Appear>
      ) : null}
      {!groups.length ? <ContentState kind="empty" title="Aún no hay recomendaciones para tu rostro" description="Toma otra foto de frente y con buena luz." actionLabel="Repetir análisis" onAction={() => goToCapture()} /> : null}
      <CoralButton title="Probarlo en el probador" onPress={() => router.push('/simulator' as never)} rightIcon={<ArrowRight size={18} color={c.onPrimary} />} fullWidth />
    </>;
  };

  const renderSilhouette = () => {
    if (!diagnostic) return null;
    if (!silhouettePending) {
      return (
        <CoralCard radius={24} style={styles.gap}>
          <View style={styles.cardHead}>
            <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Tu silueta</Text>
            {why('Tu silueta')}
          </View>
          <Text style={[styles.toneValue, { color: c.ink }]}>{diagnostic.bodyType}</Text>
        </CoralCard>
      );
    }
    return <>
      <Appear>
        <CoralCard radius={24} style={styles.pendingCard}>
          <Mascot pose="fotografo" height={180} enter="pop" float />
          <Text accessibilityRole="header" style={[styles.lowTitle, styles.center, { color: c.ink }]}>Falta tu foto de cuerpo entero</Text>
          <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>Con ella calculamos tus proporciones y te recomendamos cortes y largos de prenda.</Text>
          <View style={styles.tips}>
            <Tip Icon={UserRound} text="De pie, de frente, todo el cuerpo" />
            <Tip Icon={Shirt} text="Ropa ajustada o de una sola pieza" />
          </View>
          <CoralButton title="Tomar foto de cuerpo" height={44} onPress={() => goToCapture('body')} leftIcon={<Camera size={18} color={c.onPrimary} />} fullWidth />
        </CoralCard>
      </Appear>
      <Text style={[coralText.caption, styles.disclaimer, { color: c.ink2 }]}>La foto de cuerpo se guarda igual que la del rostro: solo tú la ves.</Text>
    </>;
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.background[0] }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <CoralTitle prefix="Mi " accent="análisis" size={30} />
          {diagnostic ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Repetir análisis" onPress={() => goToCapture()} style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
              <RefreshCcw size={22} color={c.ink} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {diagnostic && !restoreError ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
            {sections.map(({ key, label }) => <Chip key={key} label={label} active={key === section} onPress={() => setSection(key)} />)}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + componentSizes.tabBarClearance }]}>
        {isRestoring ? <ContentState kind="thinking" loading title="Recuperando tus resultados" description="Estamos preparando tu último análisis." />
          : restoreError ? <>
            <ContentState kind="error" title="No pudimos abrir tu análisis" description={restoreError} actionLabel="Reintentar" onAction={reloadDiagnostic} />
            {/* Del Líder («fix models»): otras salidas cuando no se puede abrir el análisis. */}
            <View style={styles.altActions}>
              <CoralLink title="Tomar una foto nueva" underline onPress={() => { clearRestoreError(); goToCapture(); }} />
              <CoralLink title="Elegir de la galería" underline onPress={() => { clearRestoreError(); void pickFromGallery(); }} />
              <CoralLink title="Ver un análisis de ejemplo" underline onPress={() => { clearRestoreError(); void loadSampleDiagnostic(); }} />
            </View>
          </>
          : !diagnostic ? <>
            <ContentState kind="empty" title="Análisis pendiente" description="Toma tu primera foto y aquí verás tu paleta, tu tono, tu rostro y tu silueta." actionLabel="Tomar mi foto" onAction={() => goToCapture()} />
            <View style={styles.altActions}>
              <CoralLink title="Elegir de la galería" underline onPress={() => { void pickFromGallery(); }} />
              <CoralLink title="Ver un análisis de ejemplo" underline onPress={() => { void loadSampleDiagnostic(); }} accessibilityHint="Muestra un resultado de prueba para conocer la app" />
            </View>
          </>
          : <>
            {isSample ? (
              <Banner kind="info" title="Estás viendo un análisis de ejemplo" description="Toma tu foto para ver tus propios resultados." actionLabel="Tomar mi foto" onAction={() => goToCapture()} />
            ) : null}
            {section === 'summary' ? renderSummary() : null}
            {section === 'tone' ? renderTone() : null}
            {section === 'palette' ? renderPalette() : null}
            {section === 'face' ? renderFace() : null}
            {section === 'silhouette' ? renderSilhouette() : null}
            {section === 'simulation' ? (
              <CoralCard radius={24} style={styles.gap}>
                <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Probador e IA</Text>
                <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>
                  Prueba telas de tu paleta, prendas de tu armario y maquillaje sobre tu foto.
                </Text>
                <VirtualDrapingStudio imageUri={diagnostic.imageUri} season={diagnostic.season} />
              </CoralCard>
            ) : null}
            {section === 'summary' ? <>
              <Text style={[coralText.caption, styles.disclaimer, { color: c.ink2 }]}>
                Resultado orientativo a partir de tu foto. La luz puede influir y tu estilo siempre manda.
              </Text>
              <CoralButton title="Repetir análisis" variant="secondary" height={44} onPress={() => goToCapture()} leftIcon={<Camera size={18} color={c.ink} />} fullWidth />
            </> : null}
          </>}
      </ScrollView>

      <RecommendationReasonModal
        visible={reasonModal.visible}
        onClose={() => setReasonModal((prev) => ({ ...prev, visible: false }))}
        recommendationTitle={reasonModal.title}
        reasonSummary={reasonModal.reasonSummary}
        consideredFactors={reasonModal.consideredFactors}
        contextSummary={reasonModal.contextSummary}
      />
    </View>
  );
};

/** Rampa de tonos con marcador. Sin dato reconocible, la rampa se muestra sin marcador. */
function SkinRamp({ index }: { index: number | null }) {
  const c = useCoral();
  return (
    <View>
      <View style={styles.ramp}>
        {SKIN_RAMP.map((hex, i) => <View key={hex} style={[styles.rampCell, { backgroundColor: hex }]} />)}
        {index !== null ? <View style={[styles.marker, { left: `${(index + 0.5) * (100 / SKIN_RAMP.length)}%`, borderColor: c.ink }]} /> : null}
      </View>
      <View style={styles.rampLabels}>
        <Text style={[coralText.caption, { color: c.ink2 }]}>Claro</Text>
        <Text style={[coralText.caption, { color: c.ink2 }]}>Profundo</Text>
      </View>
    </View>
  );
}

/** Barra horizontal con etiqueta y valor en texto (nunca solo color). */
function Meter({ label, value, valueLabel, warn, strong }: { label: string; value: number; valueLabel: string; warn?: boolean; strong?: boolean }) {
  const c = useCoral();
  return (
    <View style={styles.meter} accessible accessibilityLabel={`${label}: ${valueLabel}`}>
      <View style={styles.cardHead}>
        <Text style={[strong ? coralText.strong : coralText.label, { color: c.ink }]}>{label}</Text>
        <Text style={[coralText.label, { color: warn ? '#8A5300' : strong ? c.ink : c.ink2 }]}>{valueLabel}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.muted }]}>
        <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: warn ? '#D9A441' : '#FF7A66' }]} />
      </View>
    </View>
  );
}

function Tip({ Icon, text }: { Icon: LucideIcon; text: string }) {
  const c = useCoral();
  return (
    <View style={styles.tip}>
      <Icon size={20} color={c.ink} strokeWidth={2.2} />
      <Text style={[coralText.label, { color: c.ink, flexShrink: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  altActions: { alignItems: 'center', gap: 2 },
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { paddingHorizontal: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(179, 57, 46, 0.14)' },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  content: { paddingHorizontal: 16, gap: 16, flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  gap: { gap: 12 },
  hero: { padding: 20, gap: 6 },
  eyebrow: { fontFamily: coralFonts.extrabold, letterSpacing: 0.8 },
  swatches: { flexDirection: 'row', marginVertical: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 30, borderRadius: 15 },
  why: { paddingHorizontal: 0, minHeight: 32 },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 70, paddingVertical: 12 },
  rowCopy: { flex: 1, gap: 2 },
  pending: { paddingHorizontal: 10, minHeight: 26, borderRadius: 13, justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toneValue: { fontFamily: coralFonts.title, fontSize: 26, lineHeight: 30 },
  ramp: { flexDirection: 'row', height: 30, marginTop: 10, overflow: 'visible' },
  rampCell: { flex: 1 },
  marker: { position: 'absolute', top: -10, width: 24, height: 50, marginLeft: -12, borderRadius: 12, borderWidth: 3 },
  rampLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  segment: { flexDirection: 'row', borderRadius: 20, padding: 4 },
  segItem: { flex: 1, minHeight: 34, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  meter: { gap: 10 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  lowBox: { gap: 14, padding: 18, borderRadius: 24, borderWidth: 1 },
  lowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lowTitle: { fontFamily: coralFonts.title, fontSize: 21, lineHeight: 25 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 12 },
  paletteCell: { width: 70, gap: 6 },
  chipColor: { width: 70, height: 50, borderRadius: 16, borderWidth: 1 },
  avoidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  avoidItem: { flexDirection: 'row', alignItems: 'center', gap: 10, flexBasis: '45%', flexGrow: 1 },
  avoidDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  metals: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingHorizontal: 8 },
  faceCard: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  faceShape: { width: 64, height: 84, borderRadius: 42, borderWidth: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pendingCard: { alignItems: 'center', gap: 12 },
  tips: { alignSelf: 'stretch', gap: 10, paddingHorizontal: 8 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disclaimer: { marginHorizontal: 8, fontSize: 12.5, lineHeight: 18 },
});
