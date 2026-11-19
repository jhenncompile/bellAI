import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { ChevronDown, ChevronUp, CircleCheck, CircleX, Meh, ThumbsDown, ThumbsUp, TriangleAlert } from 'lucide-react-native';
import { coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import { friendlyMessage } from '@/shared/api/http';
import { assistantApi } from '../api/bellaiApi';
import type { DnaDimension, Explanation, FeedbackValue } from '../api/types';

/** Coral de las barras y del radar (sistema P1). */
const CORAL = '#FF7A66';

const FEEDBACK_ITEMS: { v: FeedbackValue; label: string; Icon: typeof ThumbsUp }[] = [
  { v: 'me_gusta', label: 'Me gusta', Icon: ThumbsUp },
  { v: 'neutral', label: 'Neutral', Icon: Meh },
  { v: 'no_me_gusta', label: 'No me gusta', Icon: ThumbsDown },
];

/**
 * HU-018 / HU-039: me gusta, neutral, no me gusta. Botones redondos de 44 px.
 * `options` limita las valoraciones visibles (por ejemplo, solo pulgar arriba y abajo).
 */
export function FeedbackBar({ value, onChange, disabled, options, subject, labels }: {
  value?: FeedbackValue | null;
  onChange: (v: FeedbackValue) => void;
  disabled?: boolean;
  options?: FeedbackValue[];
  /** Qué se valora, para el lector de pantalla («Me gusta: Look de oficina»). */
  subject?: string;
  /** Nombres propios para el lector de pantalla (p. ej. «Agradable» en lugar de «Me gusta»). */
  labels?: Partial<Record<FeedbackValue, string>>;
}) {
  const c = useCoral();
  const items = (options ? FEEDBACK_ITEMS.filter((i) => options.includes(i.v)) : FEEDBACK_ITEMS)
    .map((i) => ({ ...i, label: labels?.[i.v] ?? i.label }));
  return (
    <View style={styles.feedback} accessibilityRole="radiogroup" accessibilityLabel={subject ? `Valorar ${subject}` : 'Valorar'}>
      {items.map(({ v, label, Icon }) => {
        const active = value === v;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityLabel={subject ? `${label}: ${subject}` : label}
            accessibilityState={{ checked: active, disabled: Boolean(disabled) }}
            disabled={disabled}
            onPress={() => {
              hapticFeedback.light();
              onChange(v);
            }}
            style={({ pressed }) => [
              styles.feedbackBtn,
              { borderColor: active ? c.ink : c.fieldStroke, backgroundColor: active ? c.primary : c.card },
              pressed && { opacity: 0.7 },
              disabled && { opacity: 0.5 },
            ]}
          >
            <Icon size={19} color={active ? c.onPrimary : c.ink} strokeWidth={2.2} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** HU-014 / HU-042: enlace «¿Por qué?» que despliega la explicación y, a petición, la del asistente. */
export function WhyPanel({ explanation, kind, data, label = '¿Por qué?' }: {
  explanation: Explanation[];
  kind: string;
  data: Record<string, unknown>;
  label?: string;
}) {
  const c = useCoral();
  const [open, setOpen] = useState(false);
  const [natural, setNatural] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assistantApi.explain(kind, data);
      setNatural(res.explanation);
    } catch (err) {
      setError(friendlyMessage(err, 'No pudimos generar la explicación. Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  };
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={4}
        style={({ pressed }) => [styles.whyToggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={[coralText.label, styles.underline, { color: c.ink }]}>{label}</Text>
        <Chevron size={18} color={c.ink} strokeWidth={2.2} />
      </Pressable>
      {open ? (
        <View style={[styles.whyBox, { backgroundColor: c.muted }]}>
          {explanation.map((e, i) => (
            <Text key={i} style={[coralText.small, { color: c.ink }]}>
              <Text style={{ fontFamily: coralFonts.extrabold }}>{e.factor}</Text>
              {e.value && e.value !== '-' ? ` (${e.value})` : ''}: {e.rule}
            </Text>
          ))}
          {natural ? <Text style={[coralText.small, { color: c.ink2 }]}>{natural}</Text> : null}
          {error ? (
            <View style={styles.whyError} accessibilityLiveRegion="polite">
              <TriangleAlert size={16} color={c.danger} strokeWidth={2.3} />
              <Text style={[coralText.small, styles.flex, { color: c.danger }]}>{error}</Text>
            </View>
          ) : null}
          {!natural ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              onPress={ask}
              disabled={loading}
              style={({ pressed }) => [styles.askBtn, pressed && { opacity: 0.6 }]}
            >
              {loading ? <ActivityIndicator color={c.ink} accessibilityLabel="Preparando la explicación" /> : (
                <Text style={[coralText.label, styles.underline, { color: c.ink }]}>Explícamelo con más detalle</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Barra de puntaje coral con el valor en texto. */
export function ScoreBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const c = useCoral();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.scoreRow} accessible accessibilityLabel={`${label}: ${pct} de 100${detail ? `. ${detail}` : ''}`}>
      <View style={styles.scoreHead}>
        <Text style={[coralText.label, styles.flex, { color: c.ink }]}>{label}</Text>
        <Text style={[coralText.label, { color: c.ink }]}>{pct}/100</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.muted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: CORAL }]} />
      </View>
      {detail ? <Text style={[coralText.caption, { color: c.ink2 }]}>{detail}</Text> : null}
    </View>
  );
}

const DIMENSIONS: DnaDimension[] = ['elegancia', 'minimalismo', 'romanticismo', 'naturalidad', 'dramatismo', 'clasicismo', 'experimentalidad'];

/** HU-008: radar de las 7 dimensiones del Style DNA. */
export function DnaRadar({ values, labels, size = 300 }: { values: Record<DnaDimension, number>; labels: Record<DnaDimension, { label: string }>; size?: number }) {
  const c = useCoral();
  const center = size / 2;
  // Margen amplio para que las etiquetas laterales (Clasicismo, Romanticismo) no se corten
  const r = size / 2 - 72;
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    return [center + Math.cos(a) * r * (v / 100), center + Math.sin(a) * r * (v / 100)];
  };
  const poly = DIMENSIONS.map((d, i) => point(i, values[d] ?? 50).join(',')).join(' ');
  const summary = DIMENSIONS.map((d) => `${labels[d]?.label ?? d} ${Math.round(values[d] ?? 0)}`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Style DNA: ${summary}`} style={styles.radar}>
      <Svg width={size} height={size}>
        {[25, 50, 75, 100].map((ring) => (
          <Polygon key={ring} points={DIMENSIONS.map((_, i) => point(i, ring).join(',')).join(' ')} fill="none" stroke={c.fieldStroke} strokeWidth={1} />
        ))}
        {DIMENSIONS.map((d, i) => {
          const [x, y] = point(i, 100);
          const [lx, ly] = point(i, 130);
          return (
            <React.Fragment key={d}>
              <Line x1={center} y1={center} x2={x} y2={y} stroke={c.fieldStroke} strokeWidth={1} />
              <SvgText x={lx} y={ly} fontSize={11.5} fontFamily={coralFonts.bold} fill={c.ink2} textAnchor="middle" alignmentBaseline="middle">
                {labels[d]?.label ?? d}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Polygon points={poly} fill={CORAL} fillOpacity={0.28} stroke={CORAL} strokeWidth={2} />
        {DIMENSIONS.map((d, i) => {
          const [x, y] = point(i, values[d] ?? 50);
          return <Circle key={d} cx={x} cy={y} r={3.5} fill={CORAL} />;
        })}
      </Svg>
    </View>
  );
}

/** Semáforo P1: color, icono y texto (nunca solo color). */
const LIGHT = {
  verde: { label: 'Compatible', color: '#2F6B3F', bg: '#E3F1E6', Icon: CircleCheck },
  amarillo: { label: 'Con matices', color: '#8A5300', bg: '#FFF1D6', Icon: TriangleAlert },
  rojo: { label: 'Poco compatible', color: '#B42318', bg: '#FDE7E4', Icon: CircleX },
} as const;

/** HU-024: semáforo de compatibilidad. */
export function TrafficLight({ light }: { light: 'verde' | 'amarillo' | 'rojo' }) {
  const tone = LIGHT[light];
  return (
    <View style={[styles.light, { backgroundColor: tone.bg }]} accessible accessibilityLabel={`Semáforo: ${tone.label}`}>
      <tone.Icon size={20} color={tone.color} strokeWidth={2.4} />
      <Text style={[coralText.strong, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = useCoral();
  return <Text accessibilityRole="header" style={[coralText.section, styles.section, { color: c.ink }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  underline: { textDecorationLine: 'underline' },
  feedback: { flexDirection: 'row', gap: 8 },
  feedbackBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  whyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  whyBox: { borderRadius: 18, padding: 14, gap: 8 },
  whyError: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  askBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  scoreRow: { gap: 6, marginBottom: 10 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  radar: { alignItems: 'center' },
  light: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 14, borderRadius: 18 },
  section: { marginTop: 20, marginBottom: 8 },
});
