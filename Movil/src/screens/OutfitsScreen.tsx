import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, Plus, Sparkles, TriangleAlert } from 'lucide-react-native';
import { Banner, Chip, ContentState, PageHeader, useNotice } from '@/shared/ui';
import { Appear, CoralButton, CoralCard, CoralLink, CoralScreen, Mascot, coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import { outfitsApi, styleApi } from '@/features/bellai/api/bellaiApi';
import type { CompareResponse, FeedbackValue, GenerateOutfitsResponse, OutfitProposal } from '@/features/bellai/api/types';
import { SectionTitle, WhyPanel } from '@/features/bellai/ui/components';
import { FavoriteButton, RatingBar } from '@/features/bellai/ui/OutfitRatingControls';
import { FEEDBACK_TO_RATING, RATING_TO_FEEDBACK } from '@/features/bellai/model/outfitRating';
import { approximateLocation } from '@/features/bellai/model/location';
import { OutfitComparison } from '@/widgets/OutfitComparison/ui/OutfitComparison';

const OCCASIONS = ['Trabajo', 'Universidad', 'Cita', 'Fiesta', 'Entrevista', 'Formal', 'Casual', 'Deporte'];
const ROLE: Record<string, string> = { superior: 'Arriba', inferior: 'Abajo', vestido: 'Vestido', calzado: 'Calzado', abrigo: 'Abrigo', accesorio: 'Accesorio' };

/** Puntaje 0–1 a texto: nunca solo el número. */
function scoreText(score: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const label = pct >= 80 ? 'Muy buena combinación' : pct >= 60 ? 'Buena combinación' : pct >= 40 ? 'Combinación aceptable' : 'Combinación arriesgada';
  return `${label} · ${pct}/100`;
}

/** HU-015/016 (generar por ocasión, clima y presupuesto), HU-017 (comparar), HU-018 (guardar y valorar). */
export const OutfitsScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const [occasion, setOccasion] = useState('Trabajo');
  const [manualTemp, setManualTemp] = useState<number | null>(null);
  const [data, setData] = useState<GenerateOutfitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [ratings, setRatings] = useState<Record<string, FeedbackValue>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const generate = async () => {
    setLoading(true);
    setError(null);
    setComparison(null);
    setSelected([]);
    try {
      const loc = manualTemp === null ? await approximateLocation() : null;
      const res = await outfitsApi.generate({ occasion, count: 3, ...(loc ?? {}), ...(manualTemp !== null ? { temperatureC: manualTemp } : {}) });
      setData(res);
    } catch (err) {
      setError(friendlyMessage(err, 'Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  const compare = async () => {
    if (!data || selected.length < 2) return;
    setComparing(true);
    try {
      const outfits = selected
        .map((id) => data.proposals.find((p) => p.id === id))
        .filter((p): p is OutfitProposal => Boolean(p))
        .map((p) => ({ itemIds: p.items.map((i) => i.id), title: p.title }));
      setComparison(await outfitsApi.compare({ occasion, outfits, ...(data.weather ? { temperatureC: data.weather.temperatureC, rainy: data.weather.rainy } : {}) }));
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos comparar los outfits. Inténtalo de nuevo.') });
    } finally {
      setComparing(false);
    }
  };

  const openAvatar = (outfitId: string) => router.push({ pathname: '/avatar', params: { outfitId } } as any);

  /** Guarda el outfit y devuelve su id (o null si falló). */
  const save = async (p: OutfitProposal, silent = false, favorite?: boolean): Promise<string | null> => {
    if (savedIds[p.id]) return savedIds[p.id];
    setSavingId(p.id);
    try {
      const saved = await outfitsApi.save({
        itemIds: p.items.map((i) => i.id), title: p.title, occasion, score: p.score,
        explanation: p.explanation.join(' '), weatherSummary: data?.weather?.summary, temperatureC: data?.weather?.temperatureC,
        // HU-22: se guarda con la valoración que ya le dio (y como favorita si la marcó)
        rating: ratings[p.id] ? FEEDBACK_TO_RATING[ratings[p.id]] : undefined,
        favorite,
      });
      setSavedIds((s) => ({ ...s, [p.id]: saved.id }));
      setFavorites((f) => ({ ...f, [p.id]: saved.favorite }));
      if (!silent) {
        notify({
          kind: 'success',
          message: favorite ? 'Guardado en tus favoritas.' : saved.alreadySaved ? 'Ya lo tenías guardado.' : 'Outfit guardado.',
          actionLabel: 'Ver guardadas',
          onAction: () => router.push('/saved-outfits' as never),
        });
      }
      return saved.id;
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos guardar el outfit. Inténtalo de nuevo.') });
      return null;
    } finally {
      setSavingId(null);
    }
  };

  /** HU-22: una favorita siempre está guardada; si no lo estaba, se guarda ya como favorita. */
  const toggleFavorite = async (p: OutfitProposal) => {
    const id = savedIds[p.id];
    if (!id) {
      await save(p, false, true);
      return;
    }
    const next = !favorites[p.id];
    setFavorites((f) => ({ ...f, [p.id]: next }));
    setSavingId(p.id);
    try {
      await outfitsApi.update(id, { favorite: next });
    } catch (err) {
      setFavorites((f) => ({ ...f, [p.id]: !next }));
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos cambiar la favorita. Inténtalo de nuevo.') });
    } finally {
      setSavingId(null);
    }
  };

  // Para verlo en el avatar hace falta que esté guardado: se guarda primero si hace falta.
  const viewInAvatar = async (p: OutfitProposal) => {
    const id = await save(p, true);
    if (id) openAvatar(id);
  };

  const rate = async (p: OutfitProposal, value: FeedbackValue) => {
    const previous = ratings[p.id];
    setRatings((r) => ({ ...r, [p.id]: value }));
    try {
      // La firma del conjunto evita volver a proponerlo si no gustó; el vector de estilo alimenta el Style DNA
      // HU-23: con sus prendas, para que las próximas propuestas suban o bajen lo que (no) agradó
      await styleApi.feedback({ targetType: 'outfit', targetId: p.id, value, attributes: { ...(p.dna ? { dna: p.dna } : {}), itemIds: p.items.map((i) => i.id) } });
      // Si ya está guardado, también queda la valoración en el outfit guardado
      if (savedIds[p.id]) await styleApi.feedback({ targetType: 'outfit', targetId: savedIds[p.id], value });
    } catch (err) {
      setRatings((r) => {
        const next = { ...r };
        if (previous) next[p.id] = previous;
        else delete next[p.id];
        return next;
      });
      notify({ kind: 'error', message: friendlyMessage(err, 'No guardamos tu valoración. Inténtalo de nuevo.') });
    }
  };

  const toggleSelect = (id: string) => {
    if (!selected.includes(id) && selected.length >= 3) {
      notify({ kind: 'info', message: 'Puedes comparar hasta 3 opciones.' });
      return;
    }
    setComparison(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const renderProposal = (p: OutfitProposal, idx: number) => {
    const isSelected = selected.includes(p.id);
    const saved = Boolean(savedIds[p.id]);
    const score = scoreText(p.score);
    return (
      <Appear key={p.id} delay={idx * 80}>
        <CoralCard radius={24} style={styles.card}>
          <View>
            <Text style={[coralText.caption, { color: c.ink2 }]}>Opción {idx + 1}</Text>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>{p.title}</Text>
            <Text style={[coralText.label, { color: c.ink2 }]} accessibilityLabel={score.replace(' · ', ', ').replace('/100', ' de 100')}>{score}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
            {p.items.map((i) => {
              const uri = EnvConfig.resolveImageUrl(i.imageUrl ?? null);
              const role = ROLE[i.role] ?? i.role;
              const name = i.name ?? i.subcategory;
              return (
                <View key={i.id} style={styles.item} accessible accessibilityLabel={`${role}: ${name}${i.color ? `, ${i.color}` : ''}`}>
                  {uri ? (
                    <Image source={{ uri }} style={[styles.itemImg, { backgroundColor: c.muted }]} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemImg, { backgroundColor: i.colorHex ?? c.muted, borderColor: c.fieldStroke }, styles.itemBlock]} />
                  )}
                  <Text numberOfLines={1} style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{role}</Text>
                  <Text numberOfLines={2} style={[coralText.caption, { color: c.ink }]}>{name}</Text>
                </View>
              );
            })}
          </ScrollView>

          {p.missing.map((m) => (
            <View key={m.role} style={styles.missing}>
              <TriangleAlert size={16} color="#8A5300" strokeWidth={2.3} />
              <Text style={[coralText.small, styles.flex, { color: c.ink }]}>
                Te falta {ROLE[m.role]?.toLowerCase() ?? m.role}: {m.suggestion}
              </Text>
            </View>
          ))}

          <WhyPanel
            explanation={p.breakdown.map((b) => ({ factor: b.factor, value: `${Math.round(b.score * 100)}/100`, rule: b.detail }))}
            kind="outfit"
            data={{ title: p.title, breakdown: p.breakdown, items: p.items.map((i) => i.name) }}
          />

          {/* HU-22: agradable, neutral o no agradable */}
          <RatingBar
            value={ratings[p.id] ? FEEDBACK_TO_RATING[ratings[p.id]] : null}
            subject={p.title}
            onChange={(r) => void rate(p, RATING_TO_FEEDBACK[r])}
            hint="¿Te agrada esta propuesta?"
          />
          <View style={styles.actions}>
            <CoralButton
              title={saved ? 'Guardado' : 'Guardar'}
              variant="secondary"
              height={44}
              disabled={saved}
              loading={savingId === p.id && !saved}
              leftIcon={saved ? <Check size={18} color={c.ink} strokeWidth={2.4} /> : undefined}
              onPress={() => void save(p)}
              accessibilityLabel={saved ? `${p.title} guardado` : `Guardar ${p.title}`}
              style={styles.flex}
            />
            <FavoriteButton active={Boolean(favorites[p.id])} subject={p.title} busy={savingId === p.id && saved} onPress={() => void toggleFavorite(p)} />
          </View>

          <View style={[styles.links, { borderTopColor: c.fieldStroke }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Comparar ${p.title}`}
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggleSelect(p.id)}
              hitSlop={4}
              style={({ pressed }) => [styles.linkToggle, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.box, { borderColor: c.ink, backgroundColor: isSelected ? c.primary : c.card }]}>
                {isSelected ? <Check size={14} color={c.onPrimary} strokeWidth={3} /> : null}
              </View>
              <Text style={[coralText.label, styles.underline, { color: c.ink }]}>Comparar</Text>
            </Pressable>
            <CoralLink
              title="Ver en mi avatar"
              underline
              disabled={savingId === p.id}
              onPress={() => void viewInAvatar(p)}
              accessibilityLabel={`Ver ${p.title} en mi avatar`}
              accessibilityHint={saved ? undefined : 'Guarda el outfit y lo abre en tu avatar'}
            />
          </View>
        </CoralCard>
      </Appear>
    );
  };

  const renderResults = () => {
    if (!data) return null;
    if (data.wardrobeSize === 0) {
      return (
        <ContentState
          kind="empty"
          title="Tu armario está vacío"
          description="Para proponerte outfits necesitamos tus prendas. Agrega algunas y vuelve aquí."
          actionLabel="Añadir prendas"
          onAction={() => router.push('/wardrobe')}
        />
      );
    }
    return (
      <>
        {data.weather ? (
          <Banner kind="info" title={`Clima: ${data.weather.summary}`} description={data.weather.rainy ? 'Se espera lluvia.' : undefined} />
        ) : null}
        {data.hints.map((h) => <Banner key={h} kind="info" title={h} />)}
        {data.proposals.length === 0 ? (
          <ContentState
            kind="empty"
            title="Sin combinaciones por ahora"
            description="No encontramos combinaciones que respeten tus colores y la ocasión. Agrega más prendas o prueba otra ocasión."
            actionLabel="Añadir prendas"
            onAction={() => router.push('/wardrobe')}
          />
        ) : null}

        {data.proposals.map(renderProposal)}

        {selected.length >= 2 ? (
          <CoralButton
            title={`Comparar ${selected.length} opciones`}
            variant="secondary"
            fullWidth
            loading={comparing}
            onPress={() => void compare()}
          />
        ) : selected.length === 1 ? (
          <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>Marca otra opción para compararlas.</Text>
        ) : null}

        {comparison ? (
          <OutfitComparison
            summary={comparison.winner?.summary ?? (comparison.winner ? `Mejor opción: ${comparison.winner.title}` : null)}
            options={comparison.results.map((r) => ({
              key: `${r.index}`,
              title: r.title,
              scoreLabel: scoreText(r.score),
              pieces: r.items.map((i) => ({
                key: i.id, role: ROLE[i.role] ?? i.role, name: i.name ?? i.subcategory, color: i.color, colorHex: i.colorHex, photoUrl: i.imageUrl,
              })),
              reasons: r.strengths ?? r.explanation,
              cautions: r.weaknesses,
              winsIn: r.winsIn,
              isWinner: Boolean(comparison.winner && !comparison.winner.tie && comparison.winner.index === r.index),
            }))}
            rows={comparison.comparison}
            onClose={() => setComparison(null)}
          />
        ) : null}
      </>
    );
  };

  return (
    <CoralScreen contentStyle={styles.content}>
      <PageHeader title="Generar" titleAccent="outfit" compact onBack={() => router.back()} description="Con tu armario real, según la ocasión y el clima." />
      <CoralLink title="Mis combinaciones guardadas" underline onPress={() => router.push('/saved-outfits' as never)} style={styles.savedLink} />

      {!data && !loading && !error ? (
        <Appear>
          <CoralCard radius={24} style={styles.intro}>
            <Mascot pose="ropa" height={110} enter="pop" />
            <View style={styles.flex}>
              <Text style={[coralText.strong, { color: c.ink }]}>Elige ocasión y clima</Text>
              <Text style={[coralText.small, { color: c.ink2 }]}>Te proponemos tres combinaciones con las prendas de tu armario.</Text>
            </View>
          </CoralCard>
        </Appear>
      ) : null}

      <View>
        <SectionTitle>¿Para qué ocasión?</SectionTitle>
        <View style={styles.wrap}>
          {OCCASIONS.map((o) => <Chip key={o} label={o} active={occasion === o} onPress={() => setOccasion(o)} />)}
        </View>
        <SectionTitle>Clima</SectionTitle>
        <View style={styles.wrap}>
          <Chip label="Usar mi ubicación" active={manualTemp === null} onPress={() => setManualTemp(null)} />
          {[8, 16, 24, 30].map((t) => <Chip key={t} label={`${t} °C`} active={manualTemp === t} onPress={() => setManualTemp(t)} />)}
        </View>
      </View>

      <CoralButton
        title={data ? 'Generar otras opciones' : 'Generar outfits'}
        onPress={() => void generate()}
        loading={loading}
        fullWidth
        leftIcon={data ? <Plus size={18} color={c.onPrimary} strokeWidth={2.4} /> : <Sparkles size={18} color={c.onPrimary} strokeWidth={2.2} />}
      />

      {error ? <Banner kind="error" title="No pudimos generar outfits" description={error} actionLabel="Reintentar" onAction={() => void generate()} /> : null}
      {loading && !data ? (
        <ContentState kind="thinking" title="Armando tus outfits" description="Combinamos tus prendas con la ocasión y el clima." />
      ) : null}

      {renderResults()}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 14 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { gap: 12 },
  items: { gap: 12 },
  item: { width: 92, gap: 2 },
  itemImg: { width: 92, height: 110, borderRadius: 18 },
  itemBlock: { borderWidth: 1 },
  missing: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  savedLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, paddingTop: 4 },
  linkToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingRight: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
