import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowRight, Camera, CircleCheck, LoaderCircle, Palette, ScanFace, Sun, X } from 'lucide-react-native';
import type { AnalysisOutcome } from '@/features/scan-diagnosis/model/useScanWorkflow';
import type { ColorSwatch } from '@/entities/diagnostic/model/types';
import { NoticeOutlet } from '@/shared/ui/Notice';
import {
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

interface AnalysisStatusModalProps {
  /** Hay un análisis en curso (A5). */
  scanning: boolean;
  progress: number;
  outcome: AnalysisOutcome | null;
  /** Datos para A6 (análisis listo). */
  season?: { lead: string; accent: string } | null;
  summary?: string;
  swatches?: ColorSwatch[];
  onSeeResults: () => void;
  /** Vuelve a la cámara; `tips` indica si deben mostrarse los consejos primero. */
  onRetry: (mode: 'face' | 'body', tips: boolean) => void;
  onClose: () => void;
}

const FIXES: { Icon: LucideIcon; text: string }[] = [
  { Icon: Sun, text: 'Ponte frente a una ventana' },
  { Icon: ScanFace, text: 'Acerca tu cara hasta llenar el óvalo' },
  { Icon: Camera, text: 'Apoya el teléfono para que no se mueva' },
];

/**
 * Estado del análisis (Penpot «Flujo 02 · Análisis (P1)»): A5 analizando, A6 listo y A7 error.
 * Reemplaza los `Alert.alert` que mostraba el flujo de análisis.
 */
export function AnalysisStatusModal({ scanning, progress, outcome, season, summary, swatches = [], onSeeResults, onRetry, onClose }: AnalysisStatusModalProps) {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const visible = scanning || Boolean(outcome);
  if (!visible) return null;

  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 };
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const steps = [
    { Icon: CircleCheck, text: 'Foto recibida', state: 'done' as const },
    { Icon: LoaderCircle, text: 'Analizando tu rostro y tu color', state: pct < 70 ? ('now' as const) : ('done' as const) },
    { Icon: Palette, text: 'Preparando tus resultados', state: pct < 70 ? ('next' as const) : ('now' as const) },
  ];

  let body: React.ReactNode = null;

  if (scanning) {
    // ------------------------------------------------ A5 · Analizando
    body = (
      <View style={[styles.page, pad]}>
        <View style={styles.middle}>
          <Mascot pose="pensando" height={130} enter="pop" />
          <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>Analizando tu foto</Text>
          <Text style={[coralText.body, styles.center, { color: c.ink2 }]}>Tarda unos segundos. Puedes dejar la app abierta.</Text>
          <View
            style={[styles.track, { backgroundColor: c.muted }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: pct }}
            accessibilityLabel="Avance del análisis"
          >
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={[coralText.label, { color: c.ink, fontFamily: coralFonts.extrabold }]}>{pct} %</Text>
          <CoralCard radius={24} style={styles.steps}>
            {steps.map(({ Icon, text, state }) => (
              <View key={text} style={styles.stepRow}>
                <Icon size={22} strokeWidth={2.3} color={state === 'done' ? '#2F6B3F' : state === 'now' ? c.ink : c.ink2} />
                <Text style={[coralText.label, { color: state === 'next' ? c.ink2 : c.ink, fontFamily: state === 'now' ? coralFonts.extrabold : coralFonts.semibold }]}>{text}</Text>
              </View>
            ))}
          </CoralCard>
        </View>
      </View>
    );
  } else if (outcome?.kind === 'success') {
    // ------------------------------------------------ A6 · Análisis listo
    const body_ = outcome.mode === 'body';
    body = (
      <View style={[styles.page, pad]}>
        <View style={styles.middle}>
          <Mascot pose="celebrando" height={135} enter="pop" />
          <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
            {body_ ? '¡Tu silueta está lista!' : '¡Tu análisis está listo!'}
          </Text>
          {!body_ && season ? (
            <CoralHero style={styles.hero} glow={{ right: -30, top: -40, size: 200 }} accessibilityLabel={`Tu estación: ${season.lead}${season.accent}`}>
              <Text style={[coralText.caption, styles.eyebrow, { color: c.heroInk }]}>TU ESTACIÓN</Text>
              <CoralTitle prefix={season.lead} accent={season.accent} size={30} color={c.heroInk} accentColor={c.heroInk} />
              {summary ? <Text style={[coralText.label, { color: c.heroInk }]}>{summary}</Text> : null}
              <View style={styles.swatches}>
                {swatches.slice(0, 5).map((s, i) => <View key={s.hex + s.name} style={[styles.swatch, { backgroundColor: s.hex, marginLeft: i ? -10 : 0 }]} />)}
              </View>
            </CoralHero>
          ) : null}
          {outcome.message ? <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>{outcome.message}</Text> : null}
        </View>
        <View style={styles.actions}>
          <CoralButton title="Ver mi análisis" onPress={onSeeResults} rightIcon={<ArrowRight size={18} color={c.onPrimary} />} fullWidth />
          <CoralLink title="Volver a Inicio" underline onPress={onClose} />
        </View>
      </View>
    );
  } else if (outcome) {
    // ------------------------------------------------ A7 · No pudimos analizar
    const mode = outcome.kind === 'permission' ? 'face' : outcome.mode;
    const photoIssue = outcome.kind === 'photo';
    body = (
      <View style={[styles.page, pad]}>
        <View style={styles.close}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={[styles.round, { backgroundColor: '#FFFFFF' }]}>
            <X size={22} color={c.ink} />
          </Pressable>
        </View>
        <View style={styles.middle}>
          <Mascot pose={photoIssue ? 'senalando' : 'error'} height={115} enter="pop" />
          <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
            {photoIssue ? (mode === 'body' ? 'No pudimos leer tu silueta' : 'No pudimos leer tu rostro') : outcome.kind === 'permission' ? 'Falta un permiso' : 'No pudimos analizar la foto'}
          </Text>
          <Text style={[coralText.body, styles.center, { color: c.ink2 }]} accessibilityLiveRegion="polite">{outcome.message}</Text>
          {photoIssue && mode === 'face' ? (
            <CoralCard radius={24} style={styles.steps}>
              {FIXES.map(({ Icon, text }, i) => (
                <View key={text} style={styles.stepRow}>
                  <CoralIconBox gradient={c.tiles[i]} size={36} radius={12}><Icon size={20} color="#2A1714" strokeWidth={2.2} /></CoralIconBox>
                  <Text style={[coralText.label, styles.flex, { color: c.ink }]}>{text}</Text>
                </View>
              ))}
            </CoralCard>
          ) : null}
        </View>
        <View style={styles.actions}>
          <CoralButton
            title={outcome.kind === 'permission' ? 'Entendido' : 'Intentar de nuevo'}
            onPress={() => (outcome.kind === 'permission' ? onClose() : onRetry(mode, photoIssue))}
            leftIcon={outcome.kind === 'permission' ? undefined : <Camera size={18} color={c.onPrimary} />}
            fullWidth
          />
          {outcome.kind !== 'permission' ? <CoralLink title="Ahora no" underline onPress={onClose} /> : null}
        </View>
      </View>
    );
  }

  return (
    <Modal visible animationType="fade" onRequestClose={scanning ? () => undefined : onClose}>
      <View style={[styles.flex, { backgroundColor: c.background[0] }]}>{body}</View>
      <NoticeOutlet />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  page: { flex: 1, paddingHorizontal: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { fontFamily: coralFonts.title, fontSize: 27, lineHeight: 32, textAlign: 'center' },
  track: { alignSelf: 'stretch', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#FF7A66' },
  steps: { alignSelf: 'stretch', gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { alignSelf: 'stretch', padding: 20, gap: 6 },
  eyebrow: { fontFamily: coralFonts.extrabold, letterSpacing: 0.8 },
  swatches: { flexDirection: 'row', marginTop: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  actions: { gap: 4, alignItems: 'center' },
  close: { alignItems: 'flex-end' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(179, 57, 46, 0.14)' },
});
