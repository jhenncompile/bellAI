import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Clock,
  Plus,
  Cloud,
  CloudOff,
  FileText,
} from 'lucide-react-native';
import { AtelierButton } from '../components/AtelierButton';
import { AtelierInput } from '../components/AtelierInput';
import { AtelierScreen } from '../components/AtelierScreen';
import { EmptyWardrobeState } from '../components/EmptyWardrobeState';
import { GarmentGridCard } from '../components/GarmentGridCard';
import { atelierRadii, atelierShadows, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';
import { wardrobeService } from '../services/wardrobeService';
import {
  CATEGORY_LABELS,
  CATEGORY_SUBCATEGORIES,
  OCCASION_LABELS,
  SEASON_LABELS,
  SUBCATEGORY_LABELS,
  WardrobeCategory,
  WardrobeItem,
  WardrobeOccasion,
  WardrobeSeason,
  WardrobeStatus,
  WardrobeSubcategory,
  WardrobeSummary,
  WARDROBE_OCCASIONS,
} from '../types/wardrobe.types';

interface MyWardrobeScreenProps {
  onOpenNewGarment: () => void;
  onSelectGarment: (item: WardrobeItem) => void;
  onOpenHistory: () => void;
  refreshTrigger?: number;
}

const CATEGORIES: { key: 'all' | WardrobeCategory; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'superior', label: CATEGORY_LABELS.superior },
  { key: 'inferior', label: CATEGORY_LABELS.inferior },
  { key: 'calzado', label: CATEGORY_LABELS.calzado },
  { key: 'abrigo', label: CATEGORY_LABELS.abrigo },
  { key: 'accesorio', label: CATEGORY_LABELS.accesorio },
];

const SEASONS: { key: 'all' | WardrobeSeason; label: string }[] = [
  { key: 'all', label: 'Toda temporada' },
  { key: 'primavera', label: SEASON_LABELS.primavera },
  { key: 'verano', label: SEASON_LABELS.verano },
  { key: 'otono', label: SEASON_LABELS.otono },
  { key: 'invierno', label: SEASON_LABELS.invierno },
  { key: 'todo_el_ano', label: SEASON_LABELS.todo_el_ano },
];

const STATUSES: { key: 'all' | WardrobeStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'confirmed', label: 'Confirmadas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'upload_failed', label: 'Foto pendiente' },
];

function normalizeSearchValue(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Pantalla "Mi Armario" (HU-011):
 * - Cuadrícula de 2 columnas con foto mejorada, nombre y categoría/color/talla de cada prenda.
 * - Búsqueda por texto y filtros por categoría, color y temporada.
 * - Armario vacío: muestra mensaje que invita a agregar la primera prenda.
 */
export const MyWardrobeScreen: React.FC<MyWardrobeScreenProps> = ({
  onOpenNewGarment,
  onSelectGarment,
  onOpenHistory,
  refreshTrigger = 0,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [summary, setSummary] = useState<WardrobeSummary | null>(null);
  const [isWardrobeEmpty, setIsWardrobeEmpty] = useState<boolean>(false);
  const [emptyStateMeta, setEmptyStateMeta] = useState<{
    title: string;
    message: string;
    ctaLabel: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | WardrobeCategory>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<
    'all' | WardrobeSubcategory
  >('all');
  const [selectedSeason, setSelectedSeason] = useState<'all' | WardrobeSeason>('all');
  const [selectedOccasion, setSelectedOccasion] = useState<'all' | WardrobeOccasion>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | WardrobeStatus>('all');
  const [colorFilter, setColorFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromOfflineCache, setFromOfflineCache] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const wardrobeRequestId = useRef(0);

  const loadWardrobe = useCallback(
    async (isPullRefresh = false) => {
      const requestId = ++wardrobeRequestId.current;
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setLoadError(null);

      try {
        // Sincronizar paquete completo en segundo plano para mantener actualizado el modo offline (HU-040)
        wardrobeService.fetchSyncSnapshot().catch(() => undefined);

        const { data, fromOfflineCache: isOffline } =
          await wardrobeService.getWardrobe({
            category: selectedCategory === 'all' ? undefined : selectedCategory,
            subcategory: selectedSubcategory === 'all' ? undefined : selectedSubcategory,
            season: selectedSeason === 'all' ? undefined : selectedSeason,
            occasion: selectedOccasion === 'all' ? undefined : selectedOccasion,
            status: selectedStatus === 'all' ? undefined : selectedStatus,
            color: colorFilter.trim() || undefined,
          });

        if (requestId !== wardrobeRequestId.current) return;

        setItems(data.items || []);
        setSummary(data.summary || null);
        setIsWardrobeEmpty(Boolean(data.isEmpty));
        setEmptyStateMeta(data.emptyState || null);
        setFromOfflineCache(isOffline);
      } catch {
        if (requestId === wardrobeRequestId.current) {
          setLoadError('No pudimos cargar tu armario. Revisa tu conexión e inténtalo de nuevo.');
        }
      } finally {
        if (requestId === wardrobeRequestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedCategory, selectedSubcategory, selectedSeason, selectedOccasion, selectedStatus, colorFilter],
  );

  useEffect(() => {
    loadWardrobe(false);
  }, [loadWardrobe, refreshTrigger]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSelectedSeason('all');
    setSelectedOccasion('all');
    setSelectedStatus('all');
    setColorFilter('');
  };

  const totalCount =
    (summary?.totalConfirmed || 0) + (summary?.totalDrafts || 0);
  const visibleItems = useMemo(() => {
    const query = normalizeSearchValue(searchQuery);
    if (!query) return items;

    return items.filter((item) => {
      const occasion = item.bottomDetails.occasion;
      const statusLabel =
        item.status === 'confirmed'
          ? 'confirmada'
          : item.status === 'upload_failed'
            ? 'foto pendiente'
            : 'borrador';
      const searchableText = normalizeSearchValue(
        [
          item.name,
          item.bottomDetails.color,
          item.bottomDetails.colorHex,
          item.category,
          CATEGORY_LABELS[item.category],
          item.subcategory,
          SUBCATEGORY_LABELS[item.subcategory],
          item.bottomDetails.season,
          item.bottomDetails.season?.replace(/_/g, ' '),
          occasion,
          occasion ? OCCASION_LABELS[occasion] : '',
          item.status,
          statusLabel,
        ].filter(Boolean).join(' '),
      );
      return searchableText.includes(query);
    });
  }, [items, searchQuery]);

  return (
    <AtelierScreen
      subtitle="Armario digital • HU-011"
      title="Mi Armario"
      refreshing={refreshing}
      onRefresh={() => loadWardrobe(true)}
      rightSlot={
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenHistory}
          style={styles.avatarBtn}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color={atelierColors.textPrimary} />
            <Text style={styles.avatarLetter}>Historial</Text>
          </View>
        </TouchableOpacity>
      }
    >
      <AtelierButton
        title="Agregar nueva prenda"
        icon={<Plus size={16} color={atelierColors.surfaceWhite} />}
        onPress={onOpenNewGarment}
        style={styles.addGarmentBtn}
      />

      {/* Insignia de estado de respaldo en la nube / modo sin conexión (HU-040) */}
      <View style={styles.statusBannerRow}>
        <View
          style={[
            styles.syncPill,
            fromOfflineCache ? styles.syncPillOffline : styles.syncPillOnline,
            { flexDirection: 'row', alignItems: 'center', gap: 5 },
          ]}
        >
          {fromOfflineCache ? (
            <CloudOff size={12} color={atelierColors.textSecondary} />
          ) : (
            <Cloud size={12} color={atelierColors.terracotta} />
          )}
          <Text
            style={[
              styles.syncPillText,
              fromOfflineCache ? styles.syncPillTextOffline : styles.syncPillTextOnline,
            ]}
          >
            {fromOfflineCache
              ? 'Modo sin conexión (copia local)'
              : 'Respaldado en la nube'}
          </Text>
        </View>

        {summary && summary.totalDrafts > 0 ? (
          <View style={[styles.draftCountPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <FileText size={12} color={atelierColors.warning} />
            <Text style={styles.draftCountText}>
              {summary.totalDrafts} borrador{summary.totalDrafts > 1 ? 'es' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Buscador por texto y botón de filtros avanzados (HU-011) */}
      <AtelierInput
        placeholder="Buscar nombre, color, tipo, temporada u ocasión..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        rightActionLabel={showAdvancedFilters ? 'Ocultar filtros' : 'Más filtros'}
        onRightActionPress={() => setShowAdvancedFilters((prev) => !prev)}
        containerStyle={styles.searchContainer}
      />

      {/* Filtros adicionales del armario (HU-011) */}
      {showAdvancedFilters ? (
        <View style={styles.advancedFiltersCard}>
          <AtelierInput
            label="Filtrar por color"
            placeholder="Ej. Azul Marino, Negro, Beige, Vino..."
            value={colorFilter}
            onChangeText={setColorFilter}
            rightActionLabel={colorFilter ? 'Limpiar' : undefined}
            onRightActionPress={() => setColorFilter('')}
          />
          <Text style={styles.filterGroupLabel}>Tipo de prenda</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Todos los tipos de prenda"
              accessibilityState={{ selected: selectedSubcategory === 'all' }}
              onPress={() => setSelectedSubcategory('all')}
              style={[styles.filterPill, selectedSubcategory === 'all' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, selectedSubcategory === 'all' && styles.filterPillTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {(selectedCategory === 'all'
              ? Object.keys(SUBCATEGORY_LABELS) as WardrobeSubcategory[]
              : CATEGORY_SUBCATEGORIES[selectedCategory]
            ).map((subcategory) => {
              const active = selectedSubcategory === subcategory;
              return (
                <TouchableOpacity
                  key={subcategory}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por tipo ${SUBCATEGORY_LABELS[subcategory]}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedSubcategory(subcategory)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {SUBCATEGORY_LABELS[subcategory]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>Ocasión</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Todas las ocasiones"
              accessibilityState={{ selected: selectedOccasion === 'all' }}
              onPress={() => setSelectedOccasion('all')}
              style={[
                styles.filterPill,
                selectedOccasion === 'all' && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedOccasion === 'all' && styles.filterPillTextActive,
                ]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            {WARDROBE_OCCASIONS.map((occasion) => {
              const active = selectedOccasion === occasion;
              return (
                <TouchableOpacity
                  key={occasion}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por ocasión ${OCCASION_LABELS[occasion]}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedOccasion(occasion)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      active && styles.filterPillTextActive,
                    ]}
                  >
                    {OCCASION_LABELS[occasion]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>Temporada</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {SEASONS.map((s) => {
              const active = selectedSeason === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSelectedSeason(s.key)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      active && styles.filterPillTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>Estado de la prenda</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {STATUSES.map((status) => {
              const active = selectedStatus === status.key;
              return (
                <TouchableOpacity
                  key={status.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por estado: ${status.label}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedStatus(status.key)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Barra de filtros por Categoría (Todo, Superior, Inferior, Calzado, Abrigo) */}
      <View style={styles.categoriesScroll}>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          const count =
            cat.key === 'all'
              ? totalCount
              : summary?.byCategory?.[cat.key] ?? 0;

          return (
            <TouchableOpacity
              key={cat.key}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por categoría ${cat.label}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                setSelectedCategory(cat.key);
                if (
                  cat.key !== 'all' &&
                  selectedSubcategory !== 'all' &&
                  !CATEGORY_SUBCATEGORIES[cat.key].includes(selectedSubcategory)
                ) {
                  setSelectedSubcategory('all');
                }
              }}
              style={[
                styles.categoryChip,
                isSelected && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && styles.categoryChipTextActive,
                ]}
              >
                {cat.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenido Principal: Cargando / Armario Vacío / Sin Coincidencias / Cuadrícula 2 Columnas */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={atelierColors.terracotta} />
          <Text style={styles.loaderText}>Organizando tu armario personal...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <AtelierButton title="Reintentar" onPress={() => loadWardrobe(false)} />
        </View>
      ) : isWardrobeEmpty ? (
        <EmptyWardrobeState
          title={emptyStateMeta?.title}
          message={emptyStateMeta?.message}
          ctaLabel={emptyStateMeta?.ctaLabel}
          onActionPress={onOpenNewGarment}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyWardrobeState
          title="Sin coincidencias para tu búsqueda"
          message="No encontramos prendas con los filtros seleccionados. Prueba limpiando la búsqueda o eligiendo otra categoría."
          ctaLabel="Ver todo mi armario"
          onActionPress={clearAllFilters}
        />
      ) : (
        <View style={styles.gridContainer}>
          {visibleItems.map((item) => (
            <GarmentGridCard
              key={item.id}
              item={item}
              onPress={onSelectGarment}
            />
          ))}
        </View>
      )}
    </AtelierScreen>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  addGarmentBtn: {
    marginBottom: 12,
  },
  avatarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: atelierRadii.pill,
    backgroundColor: atelierColors.roseBlush,
    borderWidth: 1.5,
    borderColor: atelierColors.roseDust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: atelierColors.terracottaDark,
  },
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  syncPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: atelierRadii.pill,
  },
  syncPillOnline: {
    backgroundColor: atelierColors.sageLight,
  },
  syncPillOffline: {
    backgroundColor: atelierColors.amberLight,
  },
  syncPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  syncPillTextOnline: {
    color: atelierColors.sage,
  },
  syncPillTextOffline: {
    color: atelierColors.amber,
  },
  draftCountPill: {
    backgroundColor: atelierColors.amberLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: atelierRadii.pill,
  },
  draftCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: atelierColors.amber,
  },
  searchContainer: {
    marginBottom: 10,
  },
  advancedFiltersCard: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.lg,
    padding: 13,
    marginBottom: 12,
    ...atelierShadows.softCard,
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: atelierColors.mocha,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  filterPill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: atelierRadii.pill,
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    marginRight: 7,
  },
  filterPillActive: {
    backgroundColor: atelierColors.terracotta,
    borderColor: atelierColors.terracotta,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: atelierColors.mocha,
  },
  filterPillTextActive: {
    color: atelierColors.onAccent,
    fontWeight: '700',
  },
  categoriesScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 14,
  },
  categoryChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: atelierRadii.pill,
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipActive: {
    backgroundColor: atelierColors.terracotta,
    borderColor: atelierColors.terracotta,
  },
  categoryChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  categoryChipTextActive: {
    color: atelierColors.onAccent,
  },
  loaderBox: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    color: atelierColors.mocha,
    fontWeight: '600',
  },
  errorBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: atelierColors.mocha,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 2,
  },
});
