import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Banner, Chip, ContentState, Dialog, PageHeader, useNotice } from '@/shared/ui';
import { Appear, CoralButton, CoralCard, CoralLink, CoralScreen, coralText, useCoral } from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import { outfitsApi } from '@/features/bellai/api/bellaiApi';
import type { OutfitRating, SavedOutfit } from '@/features/bellai/api/types';
import { RATING_LABEL } from '@/features/bellai/model/outfitRating';
import { FavoriteButton, RatingBar } from '@/features/bellai/ui/OutfitRatingControls';

type Filter = 'todas' | 'favoritas' | OutfitRating;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'favoritas', label: 'Favoritas' },
  { value: 'agradable', label: RATING_LABEL.agradable },
  { value: 'neutral', label: RATING_LABEL.neutral },
  { value: 'no_agradable', label: RATING_LABEL.no_agradable },
];

const matches = (o: SavedOutfit, f: Filter) => (f === 'todas' ? true : f === 'favoritas' ? o.favorite : o.rating === f);

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function titleOf(o: SavedOutfit): string {
  return o.title?.trim() || o.items.map((i) => i.name ?? i.subcategory).join(' + ') || 'Combinación';
}

/** HU-22: combinaciones guardadas, con favoritas y valoración (agradable, neutral, no agradable). */
export const SavedOutfitsScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const [outfits, setOutfits] = useState<SavedOutfit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SavedOutfit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => outfitsApi.list()
    .then((list) => { setOutfits(list); setError(null); })
    .catch((err) => setError(friendlyMessage(err, 'Revisa tu conexión e inténtalo de nuevo.'))), []);

  // Al volver de otra pantalla (p. ej. tras guardar una nueva) la lista queda al día
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const patchLocal = (id: string, patch: Partial<SavedOutfit>) =>
    setOutfits((list) => list?.map((o) => (o.id === id ? { ...o, ...patch } : o)) ?? list);

  /** Cambio optimista: se ve al instante y se deshace si el servidor falla. */
  const change = async (o: SavedOutfit, patch: { favorite?: boolean; rating?: OutfitRating | null }, failMsg: string) => {
    if (busy) return;
    setBusy(o.id);
    patchLocal(o.id, patch);
    try {
      await outfitsApi.update(o.id, patch);
    } catch (err) {
      patchLocal(o.id, { favorite: o.favorite, rating: o.rating });
      notify({ kind: 'error', message: friendlyMessage(err, failMsg) });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await outfitsApi.remove(toDelete.id);
      setOutfits((list) => list?.filter((o) => o.id !== toDelete.id) ?? list);
      notify({ kind: 'success', message: 'Combinación eliminada.' });
      setToDelete(null);
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No pudimos eliminarla. Inténtalo de nuevo.') });
    } finally {
      setDeleting(false);
    }
  };

  const renderOutfit = (o: SavedOutfit, idx: number) => {
    const title = titleOf(o);
    const meta = [o.occasion, o.weatherSummary, shortDate(o.createdAt)].filter(Boolean).join(' · ');
    return (
      <Appear key={o.id} delay={Math.min(idx, 4) * 60}>
        <CoralCard radius={24} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" numberOfLines={2} style={[coralText.section, { color: c.ink }]}>{title}</Text>
              {meta ? <Text style={[coralText.caption, { color: c.ink2 }]}>{meta}</Text> : null}
            </View>
            <FavoriteButton
              active={o.favorite}
              subject={title}
              busy={busy === o.id}
              onPress={() => void change(o, { favorite: !o.favorite }, 'No pudimos cambiar la favorita. Inténtalo de nuevo.')}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
            {o.items.map((i) => {
              const uri = EnvConfig.resolveImageUrl(i.imageUrl ?? null);
              const name = i.name ?? i.subcategory;
              return (
                <View key={i.id} style={styles.item} accessible accessibilityLabel={`${name}${i.color ? `, ${i.color}` : ''}`}>
                  {uri ? (
                    <Image source={{ uri }} style={[styles.itemImg, { backgroundColor: c.muted }]} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemImg, styles.itemBlock, { backgroundColor: i.colorHex ?? c.muted, borderColor: c.fieldStroke }]} />
                  )}
                  <Text numberOfLines={2} style={[coralText.caption, { color: c.ink }]}>{name}</Text>
                </View>
              );
            })}
          </ScrollView>
          {o.items.length === 0 ? (
            <Text style={[coralText.small, { color: c.ink2 }]}>Las prendas de esta combinación ya no están en tu armario.</Text>
          ) : null}

          {o.explanation ? <Text style={[coralText.small, { color: c.ink2 }]}>{o.explanation}</Text> : null}

          <RatingBar
            value={o.rating}
            subject={title}
            disabled={busy === o.id}
            onChange={(r) => void change(o, { rating: r === o.rating ? null : r }, 'No guardamos tu valoración. Inténtalo de nuevo.')}
          />

          <View style={[styles.links, { borderTopColor: c.fieldStroke }]}>
            {o.items.length ? (
              <CoralLink
                title="Ver en mi avatar"
                underline
                onPress={() => router.push({ pathname: '/avatar', params: { outfitId: o.id } } as never)}
                accessibilityLabel={`Ver ${title} en mi avatar`}
              />
            ) : <View />}
            <CoralLink title="Eliminar" underline onPress={() => setToDelete(o)} accessibilityLabel={`Eliminar ${title}`} />
          </View>
        </CoralCard>
      </Appear>
    );
  };

  const renderBody = () => {
    if (!outfits && error) {
      return <Banner kind="error" title="No pudimos cargar tus combinaciones" description={error} actionLabel="Reintentar" onAction={() => void load()} />;
    }
    if (!outfits) return <ContentState loading title="Cargando tus combinaciones" description="Un momento, por favor." />;
    if (outfits.length === 0) {
      return (
        <ContentState
          kind="empty"
          title="Aún no guardas combinaciones"
          description="Genera outfits o revisa las combinaciones de tu armario y guarda las que te gusten."
          actionLabel="Generar outfits"
          onAction={() => router.push('/outfits' as never)}
        />
      );
    }
    const visible = outfits.filter((o) => matches(o, filter));
    return (
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const n = outfits.filter((o) => matches(o, f.value)).length;
            return (
              <Chip
                key={f.value}
                label={`${f.label} (${n})`}
                active={filter === f.value}
                onPress={() => setFilter(f.value)}
                accessibilityLabel={`${f.label}: ${n}${filter === f.value ? ', seleccionado' : ''}`}
              />
            );
          })}
        </ScrollView>
        {visible.length === 0 ? (
          <ContentState kind="empty" title="Ninguna en este filtro" description="Prueba con otro o mira todas." actionLabel="Ver todas" onAction={() => setFilter('todas')} />
        ) : (
          visible.map(renderOutfit)
        )}
      </>
    );
  };

  return (
    <CoralScreen contentStyle={styles.content}>
      <PageHeader title="Mis" titleAccent="combinaciones" compact onBack={() => router.back()} description="Las que guardaste, con tus favoritas y tu valoración." />
      {renderBody()}

      <Dialog
        visible={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        titlePrefix="¿Eliminar esta "
        titleAccent="combinación"
        titleSuffix="?"
        description="Tus prendas siguen en el armario; solo se quita la combinación guardada."
        actions={<>
          <CoralButton title="Eliminar" loading={deleting} onPress={() => void confirmDelete()} fullWidth />
          <CoralButton title="Cancelar" variant="secondary" onPress={() => setToDelete(null)} fullWidth />
        </>}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 14 },
  flex: { flex: 1 },
  chips: { gap: 8 },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  items: { gap: 12 },
  item: { width: 92, gap: 2 },
  itemImg: { width: 92, height: 110, borderRadius: 18 },
  itemBlock: { borderWidth: 1 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, paddingTop: 4 },
});
