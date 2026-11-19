import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, MessageCircle, ScanFace, Shirt, Sparkles, Star } from 'lucide-react-native';
import { Banner, ContentState } from '@/shared/ui';
import {
  CoralBackButton,
  CoralCard,
  CoralIconBox,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { FriendlyError, friendlyMessage } from '@/shared/api/http';
import { styleApi } from '@/features/bellai/api/bellaiApi';
import type { HistoryEntry } from '@/features/bellai/api/types';

/** Tinta fija sobre los iconos pastel. */
const TILE_INK = '#2A1714';

const FILTERS: { kind?: HistoryEntry['kind']; label: string }[] = [
  { label: 'Todo' }, { kind: 'diagnostico', label: 'Análisis' }, { kind: 'outfit', label: 'Outfits' },
  { kind: 'simulacion', label: 'Simulaciones' }, { kind: 'valoracion', label: 'Valoraciones' }, { kind: 'conversacion', label: 'Asistente' },
];
const KIND = {
  diagnostico: { Icon: ScanFace, label: 'Análisis', tile: 0 },
  outfit: { Icon: Shirt, label: 'Outfit', tile: 1 },
  simulacion: { Icon: Sparkles, label: 'Simulación', tile: 2 },
  valoracion: { Icon: Star, label: 'Valoración', tile: 3 },
  conversacion: { Icon: MessageCircle, label: 'Asistente', tile: 0 },
} as const;
const VALUE_TEXT: Record<string, string> = { me_gusta: 'Te gustó', neutral: 'Neutral', no_me_gusta: 'No te gustó' };
const TYPE_TEXT: Record<string, string> = { recomendacion: 'Recomendación', outfit: 'Outfit', prenda: 'Prenda', color: 'Color', estilo: 'Estilo' };

function describe(e: HistoryEntry): string {
  if (e.kind === 'valoracion') {
    const [type, value] = e.title.split(': ');
    return `${TYPE_TEXT[type] ?? type}: ${VALUE_TEXT[value] ?? value}`;
  }
  if (e.kind === 'simulacion') return { color_cabello: 'Color de cabello', maquillaje: 'Maquillaje', unas: 'Uñas', gafas: 'Gafas' }[e.title] ?? e.title;
  return e.title;
}

/** Fecha legible: «Hoy, 14:30», «Ayer, 09:10» o «12 nov 2026, 18:00». */
function readableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;
  const sameYear = d.getFullYear() === today.getFullYear();
  const day = d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${day}, ${time}`;
}

const isNetworkError = (err: unknown) =>
  (err instanceof FriendlyError && err.isNetwork) || Boolean((err as any)?.isAxiosError && !(err as any)?.response);

/** HU-028: historial de análisis, recomendaciones valoradas, outfits, simulaciones y conversaciones. */
export const HistoryScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const [kind, setKind] = useState<HistoryEntry['kind'] | undefined>();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<{ text: string; network: boolean } | null>(null);

  // Solo cambia estado al terminar la consulta; quien recarga limpia antes `items` y `error`.
  const load = useCallback(() => {
    styleApi.history(kind)
      .then((data) => {
        setError(null);
        setItems(data);
      })
      .catch((err) => {
        setItems(null);
        setError({ text: friendlyMessage(err, 'No pudimos cargar tu historial. Inténtalo de nuevo.'), network: isNetworkError(err) });
      });
  }, [kind]);

  useEffect(load, [load]);

  const reload = () => { setError(null); setItems(null); load(); };
  const filterLabel = FILTERS.find((f) => f.kind === kind)?.label;

  return (
    <CoralScreen scrollable={false} contentStyle={styles.screen}>
      <FlatList
        data={items ?? []}
        keyExtractor={(e) => `${e.kind}:${e.id}`}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <CoralBackButton onPress={() => router.back()} />
              <CoralTitle prefix="Mi " accent="historial" size={28} style={styles.flex} />
            </View>
            <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>Tus análisis, elecciones y pruebas anteriores.</Text>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(f) => f.label}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item: f }) => {
                const on = kind === f.kind;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Ver ${f.label.toLowerCase()}`}
                    onPress={() => { if (!on) { setError(null); setItems(null); setKind(f.kind); } }}
                    style={({ pressed }) => [
                      styles.chip,
                      on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
                    <Text style={[coralText.label, { color: on ? c.onPrimary : c.ink }]}>{f.label}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          error ? (
            error.network
              ? <ContentState kind="error" title="No pudimos cargar tu historial" description={error.text} actionLabel="Reintentar" onAction={reload} />
              : <Banner kind="error" title="No pudimos cargar tu historial" description={error.text} actionLabel="Reintentar" onAction={reload} />
          ) : items === null ? (
            <ContentState kind="loading" loading title="Cargando tu historial" />
          ) : kind ? (
            <ContentState
              kind="empty"
              title={`Sin ${filterLabel?.toLowerCase() ?? 'elementos'} todavía`}
              description="Prueba con «Todo» para ver el resto de tu actividad."
              actionLabel="Ver todo"
              onAction={() => { setError(null); setItems(null); setKind(undefined); }}
            />
          ) : (
            <ContentState
              kind="empty"
              title="Aún no tienes historial"
              description="Cuando hagas un análisis, generes outfits o valores recomendaciones, aparecerán aquí."
              actionLabel="Ir a Inicio"
              onAction={() => router.replace('/')}
            />
          )
        }
        renderItem={({ item: e }) => {
          const meta = KIND[e.kind];
          const date = readableDate(e.at);
          return (
            <CoralCard radius={22} padding={14}>
              <View style={styles.row} accessible accessibilityLabel={`${meta.label}: ${describe(e)}${date ? `, ${date}` : ''}`}>
                <CoralIconBox gradient={c.tiles[meta.tile]} size={44}>
                  <meta.Icon size={20} color={TILE_INK} strokeWidth={2.2} />
                </CoralIconBox>
                <View style={styles.flex}>
                  <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>
                    {meta.label}{date ? ` · ${date}` : ''}
                  </Text>
                  <Text style={[coralText.strong, { color: c.ink }]} numberOfLines={1}>{describe(e)}</Text>
                  {e.detail ? <Text style={[coralText.small, { color: c.ink2 }]} numberOfLines={2}>{e.detail}</Text> : null}
                </View>
              </View>
            </CoralCard>
          );
        }}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingHorizontal: 0 },
  content: { paddingHorizontal: 16, gap: 10, flexGrow: 1 },
  headerBlock: { gap: 10, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filters: { gap: 8, paddingVertical: 4 },
  chip: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
