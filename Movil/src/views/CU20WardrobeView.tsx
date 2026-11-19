import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, Shirt, ShoppingBag, Sparkles } from 'lucide-react-native';
import { Banner, Chip, ContentState, SearchInput } from '@/shared/ui';
import {
  CoralButton,
  CoralIconBox,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralShadow,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { componentSizes } from '@/shared/theme/tokens/spacing';
import type { WardrobeCategory, WardrobeSubcategory } from '@/features/digital-wardrobe/types/wardrobe.types';

export interface GarmentItem {
  id: string;
  name: string;
  /** Etiqueta visible del grupo (Superior, Inferior…). */
  category: string;
  color: string;
  size: string;
  photoUri?: string | null;
  timesWorn?: number;
  occasion?: string;
  /** Valores del servicio, para editar sin perder datos. */
  categoryKey?: WardrobeCategory;
  subcategory?: WardrobeSubcategory;
  subcategoryLabel?: string;
  colorHex?: string | null;
  /** `false` en borradores locales: aún no se puede registrar su uso. */
  canWear?: boolean;
}

interface CU20WardrobeViewProps {
  garments: GarmentItem[];
  onSelectGarment?: (garment: GarmentItem) => void;
  onAddNewGarment?: () => void;
  /** Abre CU-22 · Combinaciones con las prendas del armario. */
  onOpenOutfits?: () => void;
  /** Abre CU-24 · Evaluar en tienda una prenda antes de comprarla. */
  onEvaluateStoreItem?: () => void;
  loading?: boolean;
  error?: string;
  offline?: boolean;
  onRetry?: () => void;
}

const ALL = 'Todo';
const GAP = 12;
const SIDE = 16;

const usageLabel = (n?: number) => (!n ? 'Sin estrenar' : n === 1 ? 'Usada 1 vez' : `Usada ${n} veces`);

/** CU-20 · Consultar y filtrar mi armario (sistema P1). */
export const CU20WardrobeView: React.FC<CU20WardrobeViewProps> = ({
  garments,
  onSelectGarment,
  onAddNewGarment,
  onOpenOutfits,
  onEvaluateStoreItem,
  loading,
  error,
  offline,
  onRetry,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');

  const categories = useMemo(() => [ALL, ...new Set(garments.map((g) => g.category).filter(Boolean))], [garments]);
  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      garments.filter(
        (g) =>
          (category === ALL || g.category === category) &&
          `${g.name} ${g.color} ${g.category} ${g.subcategoryLabel ?? ''}`.toLocaleLowerCase().includes(query),
      ),
    [garments, category, query],
  );
  const columns = width < 350 || fontScale > 1.5 ? 1 : 2;
  const cardWidth = columns === 2 ? (Math.min(width, 520) - SIDE * 2 - GAP) / 2 : undefined;
  const firstLoad = Boolean(loading) && garments.length === 0;
  const reset = () => { setCategory(ALL); setSearch(''); };

  const shortcuts = [
    onOpenOutfits
      ? { key: 'outfits', label: 'Combinar mis prendas', hint: 'Propuestas según ocasión, temporada y clima', Icon: Sparkles, tile: 2, onPress: onOpenOutfits }
      : null,
    onEvaluateStoreItem
      ? { key: 'store', label: 'Evaluar en tienda', hint: 'Fotografía una prenda y mira si va contigo y tu armario', Icon: ShoppingBag, tile: 1, onPress: onEvaluateStoreItem }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <CoralTitle prefix="Mi " accent="armario" size={30} style={styles.flex} />
        {onAddNewGarment ? (
          <CoralButton
            title="Añadir"
            height={44}
            onPress={onAddNewGarment}
            accessibilityLabel="Añadir una prenda"
            leftIcon={<Plus size={18} color={c.onPrimary} strokeWidth={2.4} />}
          />
        ) : null}
      </View>

      {/* Accesos secundarios: CU-22 y CU-24 */}
      {shortcuts.length > 0 && !firstLoad && !(error && garments.length === 0) ? (
        <View style={[styles.shortcuts, columns === 1 && styles.shortcutsStacked]}>
          {shortcuts.map(({ key, label, hint, Icon, tile, onPress }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={hint}
              onPress={onPress}
              style={({ pressed }) => [
                styles.shortcut,
                columns === 2 && styles.flex,
                { backgroundColor: c.card },
                coralShadow(c, 6, 18, 0.1),
                pressed && styles.pressed,
              ]}
            >
              <CoralIconBox gradient={c.tiles[tile]} size={36} radius={12}>
                <Icon size={18} color={c.ink} strokeWidth={2.2} />
              </CoralIconBox>
              <Text style={[coralText.label, styles.flex, { color: c.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {offline ? (
        <Banner
          kind="info"
          title="Sin conexión"
          description="Ves las prendas guardadas en este teléfono."
          actionLabel={onRetry ? 'Reintentar' : undefined}
          onAction={onRetry}
        />
      ) : null}

      {garments.length > 0 ? (
        <>
          <SearchInput
            {...field}
            accessibilityLabel="Buscar prenda por nombre, tipo o color"
            placeholder="Buscar prenda o color"
            value={search}
            onChangeText={setSearch}
            pill={false}
          />
          {categories.length > 2 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((label) => (
                <Chip key={label} label={label} active={category === label} onPress={() => setCategory(label)} />
              ))}
            </ScrollView>
          ) : null}
          <Text accessibilityLiveRegion="polite" style={[coralText.small, { color: c.ink2 }]}>
            {filtered.length} {filtered.length === 1 ? 'prenda' : 'prendas'}
          </Text>
        </>
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (firstLoad) {
    empty = <ContentState kind="thinking" title="Abriendo tu armario" />;
  } else if (error && garments.length === 0) {
    empty = <ContentState kind="error" title="No pudimos abrir tu armario" description={error} actionLabel="Reintentar" onAction={onRetry} />;
  } else if (garments.length === 0) {
    empty = (
      <ContentState
        kind="empty"
        title="Tu armario está vacío"
        description="Toma una foto de una prenda: reconocemos su tipo y su color para que armes outfits con lo que ya tienes."
        actionLabel={onAddNewGarment ? 'Añadir mi primera prenda' : undefined}
        onAction={onAddNewGarment}
      />
    );
  } else {
    empty = (
      <ContentState
        icon={<CoralIconBox gradient={c.tiles[0]} size={56} radius={18}><Search size={26} color={c.ink} /></CoralIconBox>}
        title="No encontramos esa prenda"
        description="Prueba con otra palabra o quita el filtro."
        actionLabel="Ver todas"
        onAction={reset}
      />
    );
  }

  return (
    <CoralScreen scrollable={false} contentStyle={styles.screen}>
      <FlatList
        key={columns}
        numColumns={columns}
        data={firstLoad ? [] : filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + componentSizes.tabBarClearance }]}
        columnWrapperStyle={columns === 2 ? styles.columns : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={Boolean(loading) && garments.length > 0}
        onRefresh={onRetry}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[item.name, item.subcategoryLabel || item.category, item.color, usageLabel(item.timesWorn)].filter(Boolean).join(', ')}
            onPress={() => onSelectGarment?.(item)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.card, maxWidth: cardWidth ?? '100%' },
              coralShadow(c, 8, 22, 0.1),
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.photo}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.image} resizeMode="cover" />
              ) : (
                <LinearGradient colors={c.tiles[index % 4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.image}>
                  <Shirt size={34} color={c.ink} strokeWidth={1.8} />
                </LinearGradient>
              )}
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={[coralText.strong, { color: c.ink }]}>{item.name}</Text>
              {item.color ? (
                <View style={styles.colorRow}>
                  {item.colorHex ? <View style={[styles.dot, { backgroundColor: item.colorHex, borderColor: c.fieldStroke }]} /> : null}
                  <Text numberOfLines={1} style={[coralText.caption, styles.flex, { color: c.ink2 }]}>{item.color}</Text>
                </View>
              ) : null}
              <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{usageLabel(item.timesWorn)}</Text>
            </View>
          </Pressable>
        )}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingHorizontal: 0, paddingBottom: 0 },
  content: { paddingHorizontal: SIDE, flexGrow: 1 },
  header: { gap: 14, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcutsStacked: { flexDirection: 'column' },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22 },
  pressed: { opacity: 0.75 },
  columns: { gap: GAP },
  card: { flex: 1, borderRadius: 22, padding: 8, marginBottom: GAP },
  photo: { height: 156, borderRadius: 16, overflow: 'hidden' },
  image: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  copy: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, gap: 4 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
});
