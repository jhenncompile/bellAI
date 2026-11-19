import * as ImagePicker from 'expo-image-picker';
import React, { useState, useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  Edit2,
  Trash2,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { EnvConfig } from '../config/env';
import { AtelierButton } from '../components/AtelierButton';
import { AtelierInput } from '../components/AtelierInput';
import { AtelierScreen } from '../components/AtelierScreen';
import { atelierRadii, atelierShadows, atelierTypography, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';
import { wardrobeService } from '../services/wardrobeService';
import {
  CATEGORY_SUBCATEGORIES,
  CATEGORY_LABELS,
  OCCASION_LABELS,
  SEASON_LABELS,
  SUBCATEGORY_LABELS,
  WARDROBE_SUBCATEGORIES,
  WardrobeCategory,
  WardrobeItem,
  WardrobeOccasion,
  WardrobeSeason,
  WardrobeSubcategory,
  WARDROBE_OCCASIONS,
} from '../types/wardrobe.types';
import { ms } from '@/shared/theme/tokens/responsive';

interface GarmentDetailScreenProps {
  item: WardrobeItem;
  onBack: () => void;
  onUpdated: (updated: WardrobeItem) => void;
  onDeleted: (deletedId: string) => void;
}

const ALL_CATEGORIES: WardrobeCategory[] = [
  'superior',
  'inferior',
  'calzado',
  'abrigo',
  'accesorio',
];

const ALL_SUBCATEGORIES: WardrobeSubcategory[] = [...WARDROBE_SUBCATEGORIES];

const ALL_SEASONS: WardrobeSeason[] = [
  'primavera',
  'verano',
  'otono',
  'invierno',
  'todo_el_ano',
];

function formatSpanishDate(iso?: string | null): string {
  if (!iso) return 'Aún no registrada';
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Pantalla "Detalle de Prenda" (HU-011 y HU-009):
 * - Foto grande de estudio (con opción de alternar entre foto mejorada y original).
 * - Atributos inferiores: Color (con punto `colorHex`), Talla aproximada, Temporada y Subcategoría.
 * - Datos de uso: Fecha en que se añadió (`addedAt`), última vez que se usó (`lastWornAt`) y botón "+ Usé hoy".
 * - Si es un borrador (`draft` / `upload_failed`), permite adjuntar o reintentar subir la fotografía.
 * - Botones Editar y Eliminar con confirmación segura.
 */
export const GarmentDetailScreen: React.FC<GarmentDetailScreenProps> = ({
  item: initialItem,
  onBack,
  onUpdated,
  onDeleted,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  const [item, setItem] = useState<WardrobeItem>(initialItem);
  const [showOriginalPhoto, setShowOriginalPhoto] = useState(false);

  // Modo edición inline
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editCategory, setEditCategory] = useState<WardrobeCategory>(item.category);
  const [editSubcategory, setEditSubcategory] = useState<WardrobeSubcategory>(
    item.subcategory,
  );
  const [editColor, setEditColor] = useState(item.bottomDetails.color);
  const [editSize, setEditSize] = useState(item.bottomDetails.approximateSize);
  const [editSeason, setEditSeason] = useState<WardrobeSeason | undefined>(undefined);
  const [editOccasion, setEditOccasion] = useState<WardrobeOccasion | null>(
    item.bottomDetails.occasion || null,
  );

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSelectEditCategory = (nextCategory: WardrobeCategory) => {
    setEditCategory(nextCategory);
    if (!CATEGORY_SUBCATEGORIES[nextCategory].includes(editSubcategory)) {
      setEditSubcategory(CATEGORY_SUBCATEGORIES[nextCategory][0]);
    }
  };

  const displayImageUrl =
    item.localPhotoUri ||
    EnvConfig.resolveImageUrl(
      showOriginalPhoto
        ? item.originalImageUrl || item.enhancedImageUrl
        : item.enhancedImageUrl || item.originalImageUrl,
    );

  const handleRecordWearToday = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await wardrobeService.recordGarmentWear(item.id);
      setItem(res.item);
      onUpdated(res.item);
      setStatusMessage('Registramos que usaste esta prenda hoy.');
    } catch (error: any) {
      setStatusMessage(error?.message || 'No se pudo registrar el uso.');
    } finally {
      setBusy(false);
    }
  };

  const handleRetryDraftPhoto = async (source: 'camera' | 'gallery') => {
    setStatusMessage(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (perm.status !== 'granted') {
        setStatusMessage('Debes conceder permiso de cámara o galería para adjuntar la foto.');
        return;
      }

      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.9,
            });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      setBusy(true);
      const res = await wardrobeService.retryDraftPhotoUpload(
        item,
        pickerResult.assets[0].uri,
        source,
      );
      setItem(res.item);
      onUpdated(res.item);
      setStatusMessage('Fotografía subida con éxito. Prenda confirmada.');
    } catch (error: any) {
      setStatusMessage(error?.message || 'Falló el reintento de subida.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdits = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await wardrobeService.updateGarment(item.id, {
        name: editName.trim() || item.name,
        category: editCategory,
        subcategory: editSubcategory,
        color: editColor.trim() || undefined,
        approximateSize: editSize.trim() || undefined,
        season: editSeason,
        occasion: editOccasion,
        confirmDraft: true,
      });
      setItem(res.item);
      onUpdated(res.item);
      setIsEditing(false);
      setStatusMessage('Cambios guardados en tu armario.');
    } catch (error: any) {
      setStatusMessage(error?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await wardrobeService.deleteGarment(item.id, item.name);
      onDeleted(item.id);
    } catch (error: any) {
      setStatusMessage(error?.message || 'No se pudo eliminar la prenda.');
      setBusy(false);
    }
  };

  return (
    <AtelierScreen
      subtitle={item.bottomDetails.categoryLabel}
      title={item.name}
      rightSlot={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al armario"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onBack}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
      }
    >
      {/* Foto Grande Mejorada de Estudio */}
      <View style={styles.heroStudioCard}>
        {displayImageUrl ? (
          <Image
            source={{ uri: displayImageUrl }}
            style={styles.heroImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noPhotoHero}>
            <FileText size={32} color={atelierColors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.noPhotoTitle}>
              Borrador conservado sin fotografía
            </Text>
            <Text style={styles.noPhotoSubtitle}>
              Adjunta una foto desde tu cámara o galería para completar esta prenda.
            </Text>
          </View>
        )}

        {item.enhancedImageUrl && item.originalImageUrl ? (
          <TouchableOpacity
            onPress={() => setShowOriginalPhoto((prev) => !prev)}
            style={styles.toggleStudioBadge}
          >
            <Text style={styles.toggleStudioText}>
              {showOriginalPhoto
                ? 'Ver foto optimizada'
                : 'Ver foto original'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Si es un borrador o falló la subida de foto (HU-009), mostrar rescate inmediato */}
      {item.status !== 'confirmed' ? (
        <View style={styles.draftRescueCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <AlertCircle color={atelierColors.warning} size={16} style={{ marginRight: 6 }} />
            <Text style={styles.draftRescueTitle}>
              Prenda guardada como borrador
            </Text>
          </View>
          <Text style={styles.draftRescueText}>
            Conservamos todos tus datos. Puedes tomar o elegir la fotografía ahora para mejorarla y confirmarla en tu armario:
          </Text>
          <View style={styles.twoColBtns}>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Cámara"
                icon={<Camera size={15} color={atelierColors.textPrimary} />}
                compact
                variant="outline"
                loading={busy}
                onPress={() => handleRetryDraftPhoto('camera')}
              />
            </View>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Galería"
                icon={<ImageIcon size={15} color={atelierColors.textPrimary} />}
                compact
                variant="outline"
                loading={busy}
                onPress={() => handleRetryDraftPhoto('gallery')}
              />
            </View>
          </View>
        </View>
      ) : null}

      {statusMessage ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Franja Inferior de Atributos Importantes (Color, Talla Aproximada, Temporada) */}
      <View style={styles.attributesGrid}>
        <View style={styles.attrBox}>
          <Text style={styles.attrLabel}>COLOR</Text>
          <View style={styles.attrColorRow}>
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: item.bottomDetails.colorHex || '#C87D65' },
              ]}
            />
            <Text numberOfLines={1} style={styles.attrValue}>
              {item.bottomDetails.color}
            </Text>
          </View>
        </View>

        <View style={styles.attrBox}>
          <Text style={styles.attrLabel}>TALLA APROX.</Text>
          <Text numberOfLines={1} style={styles.attrValue}>
            {item.bottomDetails.approximateSize}
          </Text>
        </View>

        <View style={styles.attrBox}>
          <Text style={styles.attrLabel}>TEMPORADA</Text>
          <Text numberOfLines={1} style={styles.attrValue}>
            {item.bottomDetails.season}
          </Text>
        </View>

        <View style={styles.attrBox}>
          <Text style={styles.attrLabel}>OCASIÓN</Text>
          <Text numberOfLines={1} style={styles.attrValue}>
            {item.bottomDetails.occasion
              ? OCCASION_LABELS[item.bottomDetails.occasion]
              : 'Sin definir'}
          </Text>
        </View>
      </View>

      {/* Datos de Uso y Fechas */}
      <View style={styles.usageCard}>
        <View style={styles.usageRow}>
          <View>
            <Text style={styles.usageLabel}>Fecha en que se añadió</Text>
            <Text style={styles.usageValue}>
              {formatSpanishDate(item.usageStats.addedAt)}
            </Text>
          </View>
          <View style={styles.wearCountBadge}>
            <Text style={styles.wearCountText}>
              {item.usageStats.wearCount}{' '}
              {item.usageStats.wearCount === 1 ? 'uso' : 'usos'}
            </Text>
          </View>
        </View>

        <View style={[styles.usageRow, styles.usageBottomRow]}>
          <View>
            <Text style={styles.usageLabel}>Última vez que se usó</Text>
            <Text style={styles.usageValue}>
              {item.usageStats.lastWornAt
                ? formatSpanishDate(item.usageStats.lastWornAt)
                : 'Aún no la has estrenado'}
            </Text>
          </View>
          <AtelierButton
            title="+ La usé hoy"
            compact
            variant="secondary"
            loading={busy}
            onPress={handleRecordWearToday}
          />
        </View>
      </View>

      {/* Formulario de Edición o Botones de Acción (Editar y Eliminar) */}
      {isEditing ? (
        <View style={styles.editCard}>
          <Text style={styles.editSectionTitle}>Editar datos de la prenda</Text>
          <AtelierInput
            label="Nombre"
            value={editName}
            onChangeText={setEditName}
          />

          <Text style={styles.smallLabel}>Categoría</Text>
          <View style={styles.chipsRowWrap}>
            {ALL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                accessibilityRole="button"
                accessibilityLabel={`Categoría ${CATEGORY_LABELS[cat]}`}
                accessibilityState={{ selected: editCategory === cat }}
                onPress={() => handleSelectEditCategory(cat)}
                style={[
                  styles.chip,
                  editCategory === cat && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    editCategory === cat && styles.chipTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.smallLabel}>Subcategoría</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {CATEGORY_SUBCATEGORIES[editCategory].map((sub) => (
              <TouchableOpacity
                key={sub}
                accessibilityRole="button"
                accessibilityLabel={`Tipo ${SUBCATEGORY_LABELS[sub]}`}
                accessibilityState={{ selected: editSubcategory === sub }}
                onPress={() => setEditSubcategory(sub)}
                style={[
                  styles.chip,
                  editSubcategory === sub && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    editSubcategory === sub && styles.chipTextActive,
                  ]}
                >
                  {SUBCATEGORY_LABELS[sub]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.smallLabel}>Ocasión</Text>
          <View style={styles.chipsRowWrap}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Quitar ocasión"
              accessibilityState={{ selected: editOccasion === null }}
              onPress={() => setEditOccasion(null)}
              style={[styles.chip, editOccasion === null && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  editOccasion === null && styles.chipTextActive,
                ]}
              >
                Sin definir
              </Text>
            </TouchableOpacity>
            {WARDROBE_OCCASIONS.map((occasion) => {
              const label = OCCASION_LABELS[occasion];
              const active = editOccasion === occasion;
              return (
                <TouchableOpacity
                  key={occasion}
                  accessibilityRole="button"
                  accessibilityLabel={`Ocasión ${label}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setEditOccasion(occasion)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.twoColBtns}>
            <View style={styles.halfCol}>
              <AtelierInput
                label="Color"
                value={editColor}
                onChangeText={setEditColor}
              />
            </View>
            <View style={styles.halfCol}>
              <AtelierInput
                label="Talla aproximada"
                value={editSize}
                onChangeText={setEditSize}
              />
            </View>
          </View>

          <Text style={styles.smallLabel}>Temporada</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {ALL_SEASONS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setEditSeason(s)}
                style={[
                  styles.chip,
                  editSeason === s && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    editSeason === s && styles.chipTextActive,
                  ]}
                >
                  {SEASON_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.twoColBtns}>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Guardar cambios"
                loading={busy}
                onPress={handleSaveEdits}
              />
            </View>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Cancelar"
                variant="outline"
                onPress={() => setIsEditing(false)}
              />
            </View>
          </View>
        </View>
      ) : confirmingDelete ? (
        <View style={styles.deleteConfirmCard}>
          <Text style={styles.deleteConfirmTitle}>
            ¿Deseas eliminar &quot;{item.name}&quot; de tu armario?
          </Text>
          <Text style={styles.deleteConfirmText}>
            Esta acción borrará la prenda y sus fotografías de estudio de forma permanente.
          </Text>
          <View style={styles.twoColBtns}>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Sí, eliminar"
                variant="danger"
                loading={busy}
                onPress={handleConfirmDelete}
              />
            </View>
            <View style={styles.halfCol}>
              <AtelierButton
                title="Conservar prenda"
                variant="outline"
                onPress={() => setConfirmingDelete(false)}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.twoColBtns}>
          <View style={styles.halfCol}>
            <AtelierButton
              title="Editar prenda"
              icon={<Edit2 size={15} color={atelierColors.textPrimary} />}
              variant="outline"
              onPress={() => setIsEditing(true)}
            />
          </View>
          <View style={styles.halfCol}>
            <AtelierButton
              title="Eliminar"
              icon={<Trash2 size={15} color="#FFF" />}
              variant="danger"
              onPress={() => setConfirmingDelete(true)}
            />
          </View>
        </View>
      )}
    </AtelierScreen>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  backBtn: {
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    paddingHorizontal: 13,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: atelierRadii.pill,
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.espresso,
  },
  heroStudioCard: {
    height: 295,
    backgroundColor: atelierColors.bgSilk,
    borderRadius: atelierRadii.xl,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    ...atelierShadows.softCard,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  noPhotoHero: {
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  noPhotoEmoji: {
    fontSize: ms(36),
    marginBottom: 8,
  },
  noPhotoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 4,
    textAlign: 'center',
  },
  noPhotoSubtitle: {
    fontSize: 12.5,
    color: atelierColors.mocha,
    textAlign: 'center',
  },
  toggleStudioBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: atelierRadii.pill,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
  },
  toggleStudioText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: atelierColors.espresso,
  },
  draftRescueCard: {
    backgroundColor: atelierColors.amberLight,
    borderWidth: 1,
    borderColor: atelierColors.amberBorder,
    borderRadius: atelierRadii.lg,
    padding: 14,
    marginBottom: 14,
  },
  draftRescueTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 4,
  },
  draftRescueText: {
    fontSize: 12,
    color: atelierColors.mocha,
    lineHeight: 17,
    marginBottom: 10,
  },
  statusBanner: {
    backgroundColor: atelierColors.sageLight,
    borderWidth: 1,
    borderColor: atelierColors.sageBorder,
    borderRadius: atelierRadii.md,
    padding: 10,
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.espresso,
  },
  attributesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  attrBox: {
    width: '23.8%',
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.lg,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...atelierShadows.softCard,
  },
  attrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.taupe,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  attrColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSwatch: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginRight: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  attrValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.espresso,
  },
  usageCard: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.lg,
    padding: 15,
    marginBottom: 16,
    ...atelierShadows.softCard,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageBottomRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: atelierColors.bgSilk,
  },
  usageLabel: {
    fontSize: 11.5,
    color: atelierColors.mocha,
    fontWeight: '600',
    marginBottom: 2,
  },
  usageValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: atelierColors.espresso,
  },
  wearCountBadge: {
    backgroundColor: atelierColors.roseBlush,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: atelierRadii.pill,
  },
  wearCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: atelierColors.terracottaDark,
  },
  twoColBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    width: '48.5%',
  },
  editCard: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.xl,
    padding: 16,
    ...atelierShadows.softCard,
  },
  editSectionTitle: {
    fontFamily: atelierTypography.serifFamily,
    fontSize: 20,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: atelierColors.mocha,
    marginBottom: 6,
  },
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  horizontalScroll: {
    paddingBottom: 12,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: atelierRadii.pill,
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    marginRight: 7,
  },
  chipActive: {
    backgroundColor: atelierColors.terracotta,
    borderColor: atelierColors.terracotta,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  chipTextActive: {
    color: atelierColors.onAccent,
  },
  deleteConfirmCard: {
    backgroundColor: atelierColors.burgundyLight,
    borderWidth: 1,
    borderColor: atelierColors.burgundyBorder,
    borderRadius: atelierRadii.lg,
    padding: 16,
  },
  deleteConfirmTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: atelierColors.burgundy,
    marginBottom: 4,
  },
  deleteConfirmText: {
    fontSize: 12.5,
    color: atelierColors.mocha,
    marginBottom: 12,
    lineHeight: 18,
  },
});
