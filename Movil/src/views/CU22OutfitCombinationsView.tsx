import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Layers, Palette, Plus, RefreshCw, Shirt, Sparkles } from 'lucide-react-native';
import { Banner, Chip, ContentState, useNotice } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralIconBox,
  CoralLink,
  CoralTitle,
  Mascot,
  coralFonts,
  coralShadow,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import { useOutfitCombinations } from '@/features/outfit-combinations/model/useOutfitCombinations';
import {
  GeneratedOutfit,
  OutfitPiece,
  OutfitSeason,
  OutfitOccasion,
} from '@/features/outfit-combinations/model/outfit.types';
import { friendlyMessage } from '@/shared/api/http';
import { outfitsApi, styleApi } from '@/features/bellai/api/bellaiApi';
import type { OutfitRating, SavedOutfit } from '@/features/bellai/api/types';
import { comboFeedbackId, itemSetKey, RATING_TO_FEEDBACK } from '@/features/bellai/model/outfitRating';
import { FavoriteButton, RatingBar } from '@/features/bellai/ui/OutfitRatingControls';
import { OutfitComparison, type ComparisonOption } from '@/widgets/OutfitComparison/ui/OutfitComparison';

/** HU-21: hasta cuántas combinaciones se comparan a la vez (en pantalla caben bien tres columnas). */
const MAX_COMPARE = 3;

type ComparisonState = {
  options: ComparisonOption[];
  summary?: string | null;
  rows?: { factor: string; scores: number[] }[];
  note?: string | null;
};

/**
 * CU-22 · Generar combinaciones con las prendas de mi armario (HU-19).
 * HU-20 · Solicitar combinaciones según la ocasión y las condiciones climáticas del día.
 * HU-23 · Ajustar las recomendaciones según mis valoraciones.
 *
 * - Las combinaciones llegan del backend y usan sólo prendas confirmadas del armario.
 * - HU-20: Permite elegir la ocasión (trabajo, universidad, evento, entre otras).
 * - HU-20: Considera el clima del día de la ubicación de la usuaria.
 * - HU-20 Criterio 3: Si la información climática no está disponible, genera
 *   combinaciones solo por ocasión y lo informa en pantalla.
 * - HU-23: Las prendas o combinaciones valoradas negativamente se penalizan para aparecer
 *   con menor frecuencia, y las características valoradas positivamente se priorizan.
 * - HU-22: Se guarda cada combinación, se marca como favorita y se valora como agradable, neutral
 *   o no agradable; las guardadas se consultan en «Mis combinaciones».
 * - HU-21: Se marcan dos o más para compararlas lado a lado.
 */

const OCCASION_CHIPS: { label: string; value: OutfitOccasion }[] = [
  { label: 'Todas las ocasiones', value: 'todas' },
  { label: 'Trabajo', value: 'trabajo' },
  { label: 'Universidad', value: 'universidad' },
  { label: 'Evento', value: 'evento' },
  { label: 'Diario', value: 'diario' },
  { label: 'Deporte', value: 'deporte' },
];

const SEASON_CHIPS: { label: string; value: OutfitSeason | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: 'Primavera', value: 'primavera' },
  { label: 'Verano', value: 'verano' },
  { label: 'Otoño', value: 'otono' },
  { label: 'Invierno', value: 'invierno' },
];

const SIDE = 16;

interface CU22OutfitCombinationsViewProps {
  onBack?: () => void;
  /** Abre el registro de prenda cuando el armario no alcanza para combinar. */
  onAddGarment?: () => void;
  /** HU-22: abre las combinaciones guardadas */
  onOpenSaved?: () => void;
}

export const CU22OutfitCombinationsView: React.FC<CU22OutfitCombinationsViewProps> = ({
  onBack,
  onAddGarment,
  onOpenSaved,
}) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const { notify } = useNotice();
  const {
    season,
    setSeason,
    occasion,
    setOccasion,
    weatherData,
    status,
    data,
    refreshing,
    voteOutfit,
    retry,
    refresh,
  } = useOutfitCombinations();

  const outfits = data?.outfits ?? [];
  const loading = status === 'loading';

  // HU-21: comparar varias combinaciones a la vez
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // La selección y la comparación van atadas a la lista en la que se hicieron: si cambian las
  // combinaciones (otra ocasión, temporada o regenerar) dejan de aplicar solas.
  // Se usa `generatedAt`: valorar reordena la lista (HU-23) pero no la cambia, y no debe borrar la selección
  const listId = data?.generatedAt ?? null;
  const [pick, setPick] = useState<{ source: string | null; ids: string[] }>({ source: null, ids: [] });
  const [result, setResult] = useState<{ source: string | null; value: ComparisonState } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);
  const selected = pick.source === listId ? pick.ids : [];
  const comparison = result && result.source === listId ? result.value : null;
  const setComparison = (value: ComparisonState | null) => setResult(value ? { source: listId, value } : null);

  const toggleCompare = (id: string) => {
    hapticFeedback.light();
    setComparison(null);
    if (!selected.includes(id) && selected.length >= MAX_COMPARE) {
      setLimitNotice(true);
      return;
    }
    setLimitNotice(false);
    setPick({ source: listId, ids: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  };

  // HU-22: combinaciones ya guardadas en la cuenta, por sus prendas (aunque se hayan regenerado)
  const [saved, setSaved] = useState<Record<string, SavedOutfit>>({});
  const [localRatings, setLocalRatings] = useState<Record<string, OutfitRating>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const keyOf = (o: GeneratedOutfit) => itemSetKey(o.pieces.map((p) => p.item.id));
  const rememberSaved = (s: SavedOutfit) =>
    setSaved((m) => ({ ...m, [itemSetKey(s.items.map((i) => i.id))]: s }));

  const loadSaved = useCallback(() => {
    outfitsApi.list()
      .then((list) => setSaved(Object.fromEntries(list.map((s) => [itemSetKey(s.items.map((i) => i.id)), s]))))
      .catch(() => undefined); // sin conexión: se guardará al pulsar «Guardar»
  }, []);
  useEffect(loadSaved, [loadSaved]);

  const ratingOf = (o: GeneratedOutfit): OutfitRating | null =>
    saved[keyOf(o)]?.rating ?? localRatings[o.id] ?? (o.userVote === 'like' ? 'agradable' : o.userVote === 'dislike' ? 'no_agradable' : null);

  const titleFor = (o: GeneratedOutfit) => o.pieces.map((p) => p.item.name).join(' + ').slice(0, 120);

  const save = async (o: GeneratedOutfit, favorite?: boolean) => {
    setBusyId(o.id);
    try {
      const res = await outfitsApi.save({
        itemIds: o.pieces.map((p) => p.item.id),
        title: titleFor(o),
        occasion: o.occasion && o.occasion !== 'todas' ? o.occasion : occasion !== 'todas' ? occasion : undefined,
        explanation: o.reason,
        score: typeof o.score === 'number' ? Math.max(0, Math.min(1, o.score / 100)) : undefined,
        weatherSummary: (weatherData?.isAvailable && weatherData.conditionLabel) || undefined,
        temperatureC: weatherData?.isAvailable && typeof weatherData.temperature === 'number' ? weatherData.temperature : undefined,
        rating: ratingOf(o) ?? undefined,
        favorite,
      });
      rememberSaved(res);
      notify({
        kind: 'success',
        message: favorite ? 'Guardada en tus favoritas.' : res.alreadySaved ? 'Ya la tenías guardada.' : 'Combinación guardada.',
        ...(onOpenSaved ? { actionLabel: 'Ver guardadas', onAction: onOpenSaved } : {}),
      });
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos guardarla. Inténtalo de nuevo.') });
    } finally {
      setBusyId(null);
    }
  };

  const toggleFavorite = async (o: GeneratedOutfit) => {
    const current = saved[keyOf(o)];
    // Una favorita siempre está guardada: si no lo estaba, se guarda ya como favorita
    if (!current) return save(o, true);
    setBusyId(o.id);
    rememberSaved({ ...current, favorite: !current.favorite });
    try {
      rememberSaved(await outfitsApi.update(current.id, { favorite: !current.favorite }));
    } catch (err) {
      rememberSaved(current);
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos cambiar la favorita. Inténtalo de nuevo.') });
    } finally {
      setBusyId(null);
    }
  };

  const rate = async (o: GeneratedOutfit, rating: OutfitRating) => {
    setLocalRatings((m) => ({ ...m, [o.id]: rating }));
    // HU-23: lo que agrada o no se recuerda en el teléfono para reordenar las próximas propuestas
    if (rating !== 'neutral') void voteOutfit(o, rating === 'agradable' ? 'like' : 'dislike');
    const current = saved[keyOf(o)];
    if (!current) {
      // HU-23: también sin guardar queda en la cuenta, con sus prendas, para ajustar las próximas propuestas
      const itemIds = o.pieces.map((p) => p.item.id);
      styleApi.feedback({ targetType: 'outfit', targetId: comboFeedbackId(itemIds), value: RATING_TO_FEEDBACK[rating], attributes: { itemIds } })
        .catch(() => undefined); // sin conexión queda en el teléfono (arriba) y se guarda con la combinación si la guarda
      return;
    }
    rememberSaved({ ...current, rating });
    try {
      rememberSaved(await outfitsApi.update(current.id, { rating }));
    } catch (err) {
      rememberSaved(current);
      notify({ kind: 'error', message: friendlyMessage(err, 'No guardamos tu valoración. Inténtalo de nuevo.') });
    }
  };

  const runCompare = async () => {
    const chosen = selected.map((id) => outfits.find((o) => o.id === id)).filter((o): o is GeneratedOutfit => Boolean(o));
    if (chosen.length < 2) return;
    const titleOf = (o: GeneratedOutfit) => `Combinación ${outfits.indexOf(o) + 1}`;
    const base = (o: GeneratedOutfit): ComparisonOption => ({
      key: o.id,
      title: titleOf(o),
      pieces: o.pieces.map((p) => ({
        key: `${p.role}-${p.item.id}`, role: p.roleLabel, name: p.item.name, color: p.item.color, colorHex: p.item.colorHex, photoUrl: p.item.photoUrl,
      })),
      reasons: [o.reason],
    });
    setComparing(true);
    try {
      const res = await outfitsApi.compare({
        occasion: occasion !== 'todas' ? occasion : undefined,
        ...(weatherData?.isAvailable && typeof weatherData.temperature === 'number' ? { temperatureC: weatherData.temperature } : {}),
        outfits: chosen.map((o) => ({ itemIds: o.pieces.map((p) => p.item.id), title: titleOf(o) })),
      });
      const tie = Boolean(res.winner?.tie);
      setComparison({
        summary: res.winner?.summary ?? null,
        rows: res.comparison,
        options: chosen.map((o, pos) => {
          const r = res.results[pos];
          return {
            ...base(o),
            scoreLabel: r ? `${Math.round(r.score * 100)}/100` : null,
            cautions: r?.weaknesses,
            winsIn: r?.winsIn,
            isWinner: Boolean(r && !tie && res.winner?.index === r.index),
          };
        }),
      });
    } catch {
      // Sin conexión (o prendas aún sin sincronizar): igual se comparan prendas y motivo, sin puntuación
      setComparison({
        options: chosen.map(base),
        note: 'No pudimos calcular la puntuación ahora: te mostramos las prendas y el motivo de cada una.',
      });
    } finally {
      setComparing(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    <LinearGradient colors={c.background} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          status === 'ready'
            ? <RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={c.ink} colors={[c.primary]} />
            : undefined
        }
      >
        {/* Encabezado: volver + título + volver a generar */}
        <View style={styles.topBar}>
          {onBack ? (
            <CoralBackButton
              label="Volver al armario"
              onPress={() => {
                hapticFeedback.light();
                onBack();
              }}
            />
          ) : null}
          <CoralTitle accent="Combinaciones" size={26} style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a generar las combinaciones"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            onPress={() => {
              hapticFeedback.light();
              retry();
            }}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: c.card },
              coralShadow(c, 4, 12),
              (pressed || loading) && styles.dimmed,
            ]}
          >
            <RefreshCw size={20} color={c.ink} strokeWidth={2.2} />
          </Pressable>
        </View>

        <Text style={[coralText.small, { color: c.ink2 }]}>
          Propuestas para tu día según la ocasión, el clima y lo que ya valoraste.
        </Text>
        {onOpenSaved ? (
          <CoralLink
            title={Object.keys(saved).length ? `Mis combinaciones guardadas (${Object.keys(saved).length})` : 'Mis combinaciones guardadas'}
            underline
            onPress={onOpenSaved}
            style={styles.savedLink}
          />
        ) : null}

        {/* HU-20 Criterio 2 y 3: clima del día o aviso de que no está disponible */}
        {weatherData?.isAvailable ? (
          <Banner
            kind="info"
            title={`${weatherData.temperature !== null ? `${weatherData.temperature} °C · ` : ''}${weatherData.conditionLabel}`}
            description={`${weatherData.locationName} · Combinaciones adaptadas al clima`}
          />
        ) : (
          <Banner
            kind="info"
            title="Sin datos del clima"
            description={
              data?.weatherNotice ||
              'Información climática no disponible. Se generaron combinaciones solo por la ocasión seleccionada.'
            }
          />
        )}

        {/* HU-20 Criterio 1: filtro por ocasión */}
        <View style={styles.filter}>
          <Text style={[coralText.label, { color: c.ink }]}>Ocasión</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {OCCASION_CHIPS.map((chip) => (
              <Chip
                key={chip.value}
                label={chip.label}
                active={occasion === chip.value}
                onPress={() => setOccasion(chip.value)}
                accessibilityLabel={`Ocasión ${chip.label}${occasion === chip.value ? ', seleccionada' : ''}`}
              />
            ))}
          </ScrollView>
        </View>

        {/* Filtro por temporada */}
        <View style={styles.filter}>
          <Text style={[coralText.label, { color: c.ink }]}>Temporada</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SEASON_CHIPS.map((chip) => (
              <Chip
                key={chip.label}
                label={chip.label}
                active={season === chip.value}
                onPress={() => setSeason(chip.value)}
                accessibilityLabel={`Temporada ${chip.label}${season === chip.value ? ', seleccionada' : ''}`}
              />
            ))}
          </ScrollView>
        </View>

        {/* Cargando: esqueleto de tarjetas */}
        {loading ? (
          <View style={styles.list} accessible accessibilityRole="progressbar" accessibilityLabel="Generando combinaciones">
            {[0, 1, 2].map((i) => (
              <CoralCard key={i} radius={24} style={styles.card}>
                <View style={[styles.skeleton, styles.skeletonTitle, { backgroundColor: c.muted }]} />
                {[0, 1].map((r) => (
                  <View key={r} style={styles.pieceRow}>
                    <View style={[styles.thumb, { backgroundColor: c.muted }]} />
                    <View style={styles.pieceText}>
                      <View style={[styles.skeleton, styles.skeletonShort, { backgroundColor: c.muted }]} />
                      <View style={[styles.skeleton, { backgroundColor: c.muted }]} />
                    </View>
                  </View>
                ))}
              </CoralCard>
            ))}
          </View>
        ) : null}

        {/* Error con reintento */}
        {status === 'error' ? (
          <ContentState
            kind="error"
            title="No pudimos armar tus combinaciones"
            // El mensaje del hook puede venir en lenguaje técnico: se muestra uno propio.
            description="Revisa tu conexión y vuelve a intentarlo. Tus prendas siguen guardadas."
            actionLabel="Reintentar"
            onAction={retry}
          />
        ) : null}

        {/* Armario insuficiente: qué falta y cómo resolverlo */}
        {status === 'ready' && data && !data.isSufficient && data.insufficient ? (
          <Appear>
            <CoralCard radius={24} style={styles.stateCard}>
              <Mascot pose="vacio" height={120} enter="pop" />
              <Text accessibilityRole="header" style={[coralText.section, styles.center, { color: c.ink }]}>
                {data.insufficient.title}
              </Text>
              <Text style={[coralText.body, styles.center, { color: c.ink2 }]}>{data.insufficient.message}</Text>
              {data.insufficient.missing.length > 0 ? (
                <View style={styles.missingList}>
                  {data.insufficient.missing.map((m) => (
                    <View key={m} style={styles.missingRow}>
                      <Shirt size={16} color={c.ink2} strokeWidth={2.2} />
                      <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {onAddGarment ? (
                <CoralButton
                  title={data.insufficient.ctaLabel}
                  fullWidth
                  onPress={onAddGarment}
                  accessibilityLabel="Agregar una prenda a mi armario"
                  leftIcon={<Plus size={18} color={c.onPrimary} strokeWidth={2.4} />}
                />
              ) : null}
            </CoralCard>
          </Appear>
        ) : null}

        {/* Hay prendas, pero ninguna combinación para el filtro elegido */}
        {status === 'ready' && data?.isSufficient && data.noMatches ? (
          <ContentState
            kind="empty"
            icon={
              <CoralIconBox gradient={c.tiles[3]} size={56} radius={18}>
                <Layers size={26} color={c.ink} strokeWidth={2.2} />
              </CoralIconBox>
            }
            title={data.noMatches.title}
            description={data.noMatches.message}
            actionLabel={season || onAddGarment ? data.noMatches.ctaLabel : undefined}
            onAction={season ? () => setSeason(undefined) : onAddGarment}
          />
        ) : null}

        {/* Lista de combinaciones */}
        {status === 'ready' && outfits.length > 0 ? (
          <View style={styles.list}>
            <Text accessibilityLiveRegion="polite" style={[coralText.small, { color: c.ink2 }]}>
              {outfits.length === 1 ? '1 combinación' : `${outfits.length} combinaciones`}
            </Text>
            {outfits.length > 1 ? (
              <Text style={[coralText.small, { color: c.ink2 }]}>Marca «Comparar» en dos o más para verlas lado a lado.</Text>
            ) : null}
            {outfits.map((outfit, index) => (
              <Appear key={outfit.id} delay={Math.min(index, 4) * 60}>
                <OutfitCard
                  outfit={outfit}
                  index={index}
                  rating={ratingOf(outfit)}
                  onRate={(r) => { void rate(outfit, r); }}
                  savedOutfit={saved[keyOf(outfit)]}
                  busy={busyId === outfit.id}
                  onSave={() => { void save(outfit); }}
                  onToggleFavorite={() => { void toggleFavorite(outfit); }}
                  selected={selected.includes(outfit.id)}
                  onToggleCompare={outfits.length > 1 ? () => toggleCompare(outfit.id) : undefined}
                />
              </Appear>
            ))}

            {limitNotice ? (
              <Text accessibilityLiveRegion="polite" style={[coralText.small, styles.center, { color: c.ink2 }]}>
                Puedes comparar hasta {MAX_COMPARE} combinaciones a la vez.
              </Text>
            ) : null}
            {selected.length >= 2 ? (
              <CoralButton
                title={`Comparar ${selected.length} combinaciones`}
                variant="secondary"
                fullWidth
                loading={comparing}
                onPress={() => { void runCompare(); }}
              />
            ) : selected.length === 1 ? (
              <Text accessibilityLiveRegion="polite" style={[coralText.small, styles.center, { color: c.ink2 }]}>
                Marca otra combinación para compararlas.
              </Text>
            ) : null}
            {comparison ? (
              <OutfitComparison
                options={comparison.options}
                summary={comparison.summary}
                rows={comparison.rows}
                note={comparison.note}
                onClose={() => setComparison(null)}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
};

// ---------------------------------------------------------------------------
// Tarjeta de combinación con valoración (HU-20 / HU-22 / HU-23)
// ---------------------------------------------------------------------------

interface OutfitCardProps {
  outfit: GeneratedOutfit;
  index: number;
  /** HU-22: agradable, neutral o no agradable */
  rating: OutfitRating | null;
  onRate: (rating: OutfitRating) => void;
  /** HU-22: la combinación guardada en la cuenta, si lo está */
  savedOutfit?: SavedOutfit;
  busy?: boolean;
  onSave: () => void;
  onToggleFavorite: () => void;
  /** HU-21: marcada para comparar */
  selected?: boolean;
  onToggleCompare?: () => void;
}

const OutfitCard: React.FC<OutfitCardProps> = ({
  outfit, index, rating, onRate, savedOutfit, busy, onSave, onToggleFavorite, selected, onToggleCompare,
}) => {
  const c = useCoral();
  const summary = outfit.pieces.map((p) => `${p.roleLabel}: ${p.item.name}`).join('; ');
  const tags = [outfit.occasionLabel, outfit.seasonLabel].filter((t): t is string => Boolean(t));
  const subject = `la combinación ${index + 1}`;
  const isSaved = Boolean(savedOutfit);

  return (
    <CoralCard radius={24} style={styles.card}>
      <View
        accessible
        accessibilityLabel={`Combinación ${index + 1}${outfit.occasionLabel ? `, ${outfit.occasionLabel}` : ''}, ${outfit.seasonLabel}. ${summary}. Armonía: ${outfit.harmonyLabel}. ${outfit.reason}`}
        style={styles.cardBody}
      >
        <View style={styles.cardHeader}>
          <Text style={[coralText.section, styles.flex, { color: c.ink }]}>Combinación {index + 1}</Text>
          {outfit.isPrioritized ? (
            <View style={[styles.tag, { backgroundColor: c.muted }]}>
              <Sparkles size={14} color={c.ink} strokeWidth={2.2} />
              <Text style={[coralText.caption, styles.tagText, { color: c.ink }]}>Priorizada</Text>
            </View>
          ) : null}
        </View>
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: c.muted }]}>
                <Text style={[coralText.caption, styles.tagText, { color: c.ink }]}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {outfit.pieces.map((p, i) => (
          <React.Fragment key={`${p.role}-${p.item.id}`}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: c.muted }]} /> : null}
            <PieceRow piece={p} index={i} />
          </React.Fragment>
        ))}

        <View style={[styles.reason, { borderTopColor: c.muted }]}>
          <View style={styles.harmony}>
            <Palette size={16} color={c.ink} strokeWidth={2.2} />
            <Text style={[coralText.label, styles.flex, { color: c.ink }]}>Armonía: {outfit.harmonyLabel}{typeof outfit.score === 'number' ? ` · ${outfit.score} % contigo` : ''}</Text>
          </View>
          <Text style={[coralText.small, { color: c.ink2 }]}>{outfit.reason}</Text>
        </View>
      </View>

      {/* HU-22 / HU-23: valoración (también reordena las próximas propuestas) */}
      <View style={[styles.feedback, { borderTopColor: c.muted }]}>
        <RatingBar value={rating} onChange={onRate} subject={subject} hint="¿Te agrada esta propuesta?" />
      </View>

      {/* HU-22: guardar y marcar como favorita */}
      <View style={styles.saveRow}>
        <CoralButton
          title={isSaved ? 'Guardada' : 'Guardar'}
          variant="secondary"
          height={44}
          disabled={isSaved}
          loading={busy && !isSaved}
          leftIcon={isSaved ? <Check size={18} color={c.ink} strokeWidth={2.4} /> : undefined}
          onPress={onSave}
          accessibilityLabel={isSaved ? `Combinación ${index + 1} guardada` : `Guardar la combinación ${index + 1}`}
          style={styles.flex}
        />
        <FavoriteButton active={Boolean(savedOutfit?.favorite)} subject={subject} busy={busy && isSaved} onPress={onToggleFavorite} />
      </View>

      {/* HU-21: marcar para comparar con otras */}
      {onToggleCompare ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Comparar la combinación ${index + 1}`}
          accessibilityState={{ checked: Boolean(selected) }}
          onPress={onToggleCompare}
          hitSlop={4}
          style={({ pressed }) => [styles.compareToggle, { borderTopColor: c.muted }, pressed && styles.dimmed]}
        >
          <View style={[styles.compareBox, { borderColor: c.ink, backgroundColor: selected ? c.primary : c.card }]}>
            {selected ? <Check size={14} color={c.onPrimary} strokeWidth={3} /> : null}
          </View>
          <Text style={[coralText.label, styles.compareText, { color: c.ink }]}>Comparar</Text>
        </Pressable>
      ) : null}
    </CoralCard>
  );
};

const PieceRow: React.FC<{ piece: OutfitPiece; index: number }> = ({ piece, index }) => {
  const c = useCoral();
  const photo = EnvConfig.resolveImageUrl(piece.item.photoUrl);
  const swatch = piece.item.colorHex || null;
  const meta = [piece.item.color, piece.item.wearCount === 0 ? 'Sin estrenar' : null].filter(Boolean).join(' · ');

  return (
    <View style={styles.pieceRow}>
      <View style={styles.thumb}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.thumbImage} resizeMode="cover" />
        ) : swatch ? (
          <View style={[styles.thumbImage, { backgroundColor: swatch }]} />
        ) : (
          <LinearGradient colors={c.tiles[index % 4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumbImage}>
            <Shirt size={24} color={c.ink} strokeWidth={1.8} />
          </LinearGradient>
        )}
      </View>

      <View style={styles.pieceText}>
        <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{piece.roleLabel}</Text>
        <Text style={[coralText.strong, { color: c.ink }]} numberOfLines={1}>
          {piece.item.name}
        </Text>
        {meta ? (
          <View style={styles.colorRow}>
            {swatch ? <View style={[styles.colorDot, { backgroundColor: swatch, borderColor: c.fieldStroke }]} /> : null}
            <Text style={[coralText.caption, styles.flex, { color: c.ink2 }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { paddingHorizontal: SIDE, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.6 },
  filter: { gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
  list: { gap: 12 },

  // Tarjeta de combinación
  card: { gap: 12 },
  cardBody: { gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: 10, borderRadius: 14 },
  tagText: { fontFamily: coralFonts.bold },
  pieceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  pieceText: { flex: 1, gap: 2 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  divider: { height: 1 },
  reason: { gap: 6, paddingTop: 10, borderTopWidth: 1 },
  harmony: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedLink: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  compareToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingTop: 6, borderTopWidth: 1 },
  compareBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  compareText: { textDecorationLine: 'underline' },

  // Esqueleto de carga
  skeleton: { height: 12, borderRadius: 6 },
  skeletonTitle: { width: '45%', height: 18 },
  skeletonShort: { width: '35%' },

  // Armario insuficiente
  stateCard: { alignItems: 'center', gap: 12 },
  missingList: { alignSelf: 'stretch', gap: 6 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
