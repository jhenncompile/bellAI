import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Banner, Chip, ColorSwatch, ContentState, PageHeader, useNotice } from '@/shared/ui';
import { Appear, CoralCard, CoralScreen, coralText, useCoral } from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { styleApi } from '@/features/bellai/api/bellaiApi';
import type { FeedbackValue, Recommendation, RecommendationsResponse, StyleDna } from '@/features/bellai/api/types';
import { DnaRadar, FeedbackBar, ScoreBar, SectionTitle, WhyPanel } from '@/features/bellai/ui/components';

/** Fecha corta en español («14 nov»; con año si no es el actual). */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Un punto del historial sin dimensiones que destaquen es un perfil equilibrado, no «predomina» nada. */
const timelineTop = (top: string[]) => (top.length ? `Predominan ${top.join(' y ').toLowerCase()}` : 'Perfil equilibrado, sin un estilo marcado');

const OCCASIONS = ['Trabajo', 'Universidad', 'Cita', 'Fiesta', 'Entrevista', 'Casual'];
const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Colores para ti', types: ['color'] },
  { title: 'Prendas y cortes', types: ['prenda', 'escote', 'linea'] },
  { title: 'Cabello', types: ['corte_cabello', 'color_cabello'] },
  { title: 'Accesorios y gafas', types: ['accesorio', 'gafas'] },
  { title: 'Maquillaje', types: ['maquillaje'] },
  { title: 'Colores a evitar', types: ['evitar_color'] },
];

/** HU-007/008 (Style DNA), HU-012/013/014 (recomendaciones explicadas), HU-018/039 (valoración). */
export const StyleScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const { width } = useWindowDimensions();
  const [dna, setDna] = useState<StyleDna | null>(null);
  const [dnaLoading, setDnaLoading] = useState(true);
  const [dnaError, setDnaError] = useState<string | null>(null);
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | undefined>();
  const [saving, setSaving] = useState<string | null>(null);

  // El Style DNA se carga una vez; cambiar de ocasión solo recarga las recomendaciones.
  // Las peticiones solo actualizan el estado al responder; el «cargando» se marca antes de pedirlas.
  const fetchDna = useCallback(() => styleApi.dna()
    .then((d) => setDna(d))
    .catch((err) => setDnaError(friendlyMessage(err, 'Revisa tu conexión e inténtalo de nuevo.')))
    .finally(() => setDnaLoading(false)), []);

  const fetchRecs = useCallback(() => styleApi.recommendations(occasion)
    .then((r) => setRecs(r))
    .catch((err) => setRecsError(friendlyMessage(err, 'Revisa tu conexión e inténtalo de nuevo.')))
    .finally(() => setRecsLoading(false)), [occasion]);

  // HU-13: el perfil cambia con el uso (armario, diagnóstico, preferencias), así que se vuelve a
  // pedir cada vez que la pantalla gana el foco; mientras tanto se sigue viendo el anterior.
  useFocusEffect(useCallback(() => {
    void fetchDna();
  }, [fetchDna]));

  useEffect(() => {
    void fetchRecs();
  }, [fetchRecs]);

  const loadDna = () => {
    setDnaLoading(true);
    setDnaError(null);
    void fetchDna();
  };

  const loadRecs = () => {
    setRecsLoading(true);
    setRecsError(null);
    void fetchRecs();
  };

  const changeOccasion = (o: string | undefined) => {
    if (o === occasion) return;
    setRecsLoading(true);
    setRecsError(null);
    setOccasion(o);
  };

  const rate = async (rec: Recommendation, value: FeedbackValue) => {
    setSaving(rec.id);
    try {
      const dnaFactor = rec.explanation.find((e) => e.factor === 'Style DNA');
      const res = await styleApi.feedback({
        targetType: 'recomendacion',
        targetId: rec.id,
        value,
        attributes: { recommendationType: rec.type, ...(dnaFactor ? { dimension: dnaFactor.value.split(' ')[0].toLowerCase() } : {}) },
      });
      const index = recs?.items.findIndex((i) => i.id === rec.id) ?? -1;
      setRecs((cur) => cur && {
        ...cur,
        items: value === 'no_me_gusta' ? cur.items.filter((i) => i.id !== rec.id) : cur.items.map((i) => (i.id === rec.id ? { ...i, feedback: value } : i)),
      });
      if (value === 'no_me_gusta') {
        // Deshacer solo vuelve a mostrar la tarjeta; la valoración queda guardada y se puede cambiar.
        notify({
          kind: 'info',
          message: `Ocultamos «${rec.title}». Te mostraremos menos opciones así.`,
          actionLabel: 'Deshacer',
          onAction: () => setRecs((cur) => {
            if (!cur || cur.items.some((i) => i.id === rec.id)) return cur;
            const items = [...cur.items];
            items.splice(index < 0 ? items.length : Math.min(index, items.length), 0, { ...rec, feedback: 'no_me_gusta' });
            return { ...cur, items };
          }),
        });
      }
      const learned = res?.dna;
      if (learned) setDna((cur) => cur && { ...cur, dimensions: learned.dimensions, top: learned.top, interactions: learned.interactions });
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No guardamos tu valoración. Inténtalo de nuevo.') });
    } finally {
      setSaving(null);
    }
  };

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: (recs?.items ?? []).filter((i) => g.types.includes(i.type)).slice(0, 8) })).filter((g) => g.items.length),
    [recs],
  );

  // El radar cabe en la tarjeta incluso en teléfonos angostos (márgenes de pantalla y de tarjeta).
  const radarSize = Math.min(300, Math.max(240, Math.min(width, 520) - 32 - 36));

  const renderRecommendations = () => {
    if (recsError) {
      return <Banner kind="error" title="No pudimos cargar tus recomendaciones" description={recsError} actionLabel="Reintentar" onAction={loadRecs} />;
    }
    if (recsLoading) {
      return (
        <View style={styles.inlineLoading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.ink} />
          <Text style={[coralText.small, { color: c.ink2 }]}>Cargando recomendaciones{occasion ? ` para ${occasion.toLowerCase()}` : ''}…</Text>
        </View>
      );
    }
    if (!grouped.length) {
      return occasion ? (
        <ContentState kind="empty" title="Aún no hay recomendaciones para esta ocasión" description="Prueba con otra ocasión o mira todas tus recomendaciones." actionLabel="Ver todas" onAction={() => changeOccasion(undefined)} />
      ) : (
        <ContentState kind="empty" title="Aún no hay recomendaciones" description="Completa tu análisis para recibir recomendaciones a tu medida." actionLabel="Ir a Mi análisis" onAction={() => router.push('/studio')} />
      );
    }
    return grouped.map((g) => (
      <View key={g.title}>
        <SectionTitle>{g.title}</SectionTitle>
        <View style={styles.list}>
          {g.items.map((rec) => (
            <CoralCard key={rec.id} radius={24} style={styles.recCard}>
              <View style={styles.recHead}>
                {rec.hex ? <ColorSwatch color={rec.hex} label={rec.title} /> : null}
                <View style={styles.flex}>
                  <Text style={[coralText.strong, { color: c.ink }]}>{rec.title}</Text>
                  {rec.detail ? <Text style={[coralText.small, { color: c.ink2 }]}>{rec.detail}</Text> : null}
                </View>
              </View>
              {rec.type !== 'evitar_color' ? (
                <View style={styles.recFoot}>
                  <FeedbackBar value={rec.feedback} subject={rec.title} disabled={saving === rec.id} onChange={(v) => void rate(rec, v)} />
                </View>
              ) : null}
              <WhyPanel explanation={rec.explanation} kind="recomendacion" data={{ title: rec.title, type: rec.type, explanation: rec.explanation }} />
            </CoralCard>
          ))}
        </View>
      </View>
    ));
  };

  return (
    <CoralScreen>
      <PageHeader title="Mi" titleAccent="estilo" compact onBack={() => router.back()} description="Tu Style DNA y recomendaciones que aprenden de ti." />

      {dnaLoading && !dna ? (
        <ContentState loading title="Preparando tu perfil" description="Combinamos tu diagnóstico, tus preferencias y tus valoraciones." />
      ) : dnaError && !dna ? (
        <Banner kind="error" title="No pudimos cargar tu Style DNA" description={dnaError} actionLabel="Reintentar" onAction={loadDna} />
      ) : dna && dna.hasData === false ? (
        <ContentState
          kind="empty"
          title="Tu perfil de estilo aún está en blanco"
          description="Elige tus estilos preferidos o haz tu análisis. Después aprende de tu armario y de lo que valoras."
          actionLabel="Elegir mis estilos"
          onAction={() => router.push('/profile')}
        />
      ) : dna ? (
        <>
          <Appear>
            <CoralCard radius={24} style={styles.dnaCard}>
              <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Tu Style DNA</Text>
              <DnaRadar values={dna.dimensions} labels={dna.labels} size={radarSize} />
              {dna.top.length ? (
                <Text style={[coralText.body, { color: c.ink }]}>
                  Predominan {dna.top.map((t) => t.label.toLowerCase()).join(', ')}.
                  {dna.closestStyles.length ? ` Se parece a: ${dna.closestStyles.map((s) => s.style).join(', ')}.` : ''}
                </Text>
              ) : null}
              {dna.contributions?.length ? (
                <>
                  <Text style={[coralText.label, { color: c.ink }]}>Qué forma tu perfil</Text>
                  <View style={styles.sourceChips}>
                    {dna.contributions.map((s) => <Chip key={s.source} label={`${s.label} · ${s.percent} %`} />)}
                  </View>
                </>
              ) : null}
              {dna.explanation.map((e) => (
                <Text key={e} style={[coralText.small, { color: c.ink2 }]}>• {e}</Text>
              ))}
            </CoralCard>
          </Appear>

          {dna.top.length ? (
            <Appear delay={60}>
              <CoralCard radius={24} style={styles.dnaCard}>
                <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Tus dimensiones predominantes</Text>
                {dna.top.map((t) => <ScoreBar key={t.dimension} label={t.label} value={t.value / 100} detail={t.description} />)}
              </CoralCard>
            </Appear>
          ) : null}

          {dna.evolution?.timeline.length ? (
            <Appear delay={90}>
              <CoralCard radius={24} style={styles.dnaCard}>
                <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Cómo ha cambiado</Text>
                {dna.evolution.changes.length ? (
                  dna.evolution.changes.map((ch) => (
                    <Text key={ch.dimension} style={[coralText.body, { color: c.ink }]}>
                      {ch.label} {ch.delta > 0 ? 'subió' : 'bajó'} {Math.abs(Math.round(ch.delta))} puntos ({Math.round(ch.from)} → {Math.round(ch.to)})
                    </Text>
                  ))
                ) : (
                  <Text style={[coralText.small, { color: c.ink2 }]}>
                    {dna.evolution.since ? `Sin cambios notables desde el ${shortDate(dna.evolution.since)}.` : 'Sin cambios notables todavía.'} Valora recomendaciones y registra prendas para que evolucione.
                  </Text>
                )}
                {dna.evolution.timeline.slice(0, 5).map((h) => (
                  <View key={h.at + h.reason} style={styles.timelineRow} accessible accessibilityLabel={`${shortDate(h.at)}: ${h.reasonLabel}. ${timelineTop(h.top)}`}>
                    <Text style={[coralText.caption, styles.timelineDate, { color: c.ink2 }]}>{shortDate(h.at)}</Text>
                    <View style={styles.flex}>
                      <Text style={[coralText.label, { color: c.ink }]}>{h.reasonLabel}</Text>
                      <Text style={[coralText.caption, { color: c.ink2 }]}>{timelineTop(h.top)}</Text>
                    </View>
                  </View>
                ))}
              </CoralCard>
            </Appear>
          ) : null}
        </>
      ) : null}

      <Appear delay={120}>
        <SectionTitle>Recomendaciones para</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todo" active={!occasion} onPress={() => changeOccasion(undefined)} />
          {OCCASIONS.map((o) => <Chip key={o} label={o} active={occasion === o} onPress={() => changeOccasion(o)} />)}
        </ScrollView>
        {recs?.hint && !recsLoading && !recsError ? (
          <View style={styles.hint}>
            <Banner kind="info" title={recs.hint} />
          </View>
        ) : null}
        <View style={styles.recs}>{renderRecommendations()}</View>
      </Appear>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dnaCard: { gap: 10, marginBottom: 12 },
  sourceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  timelineDate: { width: 56, paddingTop: 2 },
  chips: { gap: 8, paddingVertical: 4 },
  hint: { marginTop: 12 },
  recs: { marginTop: 8 },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  list: { gap: 12 },
  recCard: { gap: 6 },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recFoot: { flexDirection: 'row', justifyContent: 'flex-end' },
});
