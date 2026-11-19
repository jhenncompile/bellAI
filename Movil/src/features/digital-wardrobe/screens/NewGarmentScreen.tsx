import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  Check,
} from 'lucide-react-native';
import { EnvConfig } from '../config/env';
import { AtelierButton } from '../components/AtelierButton';
import { AtelierInput } from '../components/AtelierInput';
import { AtelierScreen } from '../components/AtelierScreen';
import { PermissionGuideModal } from '../components/PermissionGuideModal';
import { atelierRadii, atelierShadows, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';
import { wardrobeService } from '../services/wardrobeService';
import {
  CATEGORY_LABELS,
  CATEGORY_SUBCATEGORIES,
  CaptureSource,
  MobileCaptureConfig,
  OCCASION_LABELS,
  SEASON_LABELS,
  SUBCATEGORY_LABELS,
  SUBCATEGORY_TO_CATEGORY,
  WARDROBE_SUBCATEGORIES,
  WardrobeCategory,
  WardrobeItem,
  WardrobeOccasion,
  WardrobeSeason,
  WardrobeSubcategory,
  WARDROBE_OCCASIONS,
} from '../types/wardrobe.types';
import { ms } from '@/shared/theme/tokens/responsive';

interface NewGarmentScreenProps {
  onSavedSuccess: (item: WardrobeItem) => void;
  onCancel: () => void;
}

const ALL_SUBCATEGORIES: WardrobeSubcategory[] = [...WARDROBE_SUBCATEGORIES];

const ALL_CATEGORIES: WardrobeCategory[] = [
  'superior',
  'inferior',
  'calzado',
  'abrigo',
  'accesorio',
];

const ALL_OCCASIONS = WARDROBE_OCCASIONS;

const ALL_SEASONS: WardrobeSeason[] = [
  'primavera',
  'verano',
  'otono',
  'invierno',
  'todo_el_ano',
];

/**
 * Pantalla "Nueva Prenda" (HU-009):
 * - Solicita permisos de Cámara (`CAMERA`) o Galería (`READ_MEDIA_IMAGES`) de forma amable antes de abrir el selector.
 * - Al confirmar o escanear, envía la imagen al backend (`POST /api/wardrobe/scan`) para generar la imagen mejorada realista,
 *   auto-clasificar en categoría/subcategoría (blusas, camisas, vestidos, pantalones...) y detectar color y talla aproximada.
 * - Regla de negocio: la foto y la categoría son obligatorias; el resto es opcional. Si falla la subida de la foto, se conserva el borrador.
 */
export const NewGarmentScreen: React.FC<NewGarmentScreenProps> = ({
  onSavedSuccess,
  onCancel,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  const [mobileConfig, setMobileConfig] = useState<MobileCaptureConfig | null>(null);
  const [permissionModalSource, setPermissionModalSource] = useState<CaptureSource | null>(
    null,
  );

  // Estado de captura de fotografía
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>('prenda_captura.jpg');
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [captureSource, setCaptureSource] = useState<CaptureSource>('camera');

  // Datos de la prenda (Categoría obligatoria; el resto opcional, auto-completables tras escanear)
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WardrobeCategory>('superior');
  const [subcategory, setSubcategory] = useState<WardrobeSubcategory>('blusas');
  const [color, setColor] = useState('');
  const [approximateSize, setApproximateSize] = useState('');
  const [season, setSeason] = useState<WardrobeSeason | undefined>(undefined);
  const [occasion, setOccasion] = useState<WardrobeOccasion | undefined>(undefined);

  // Resultado del escaneo inteligente (vista previa de imagen mejorada antes o al guardar)
  const [scannedItem, setScannedItem] = useState<WardrobeItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    wardrobeService
      .getMobileConfig()
      .then(setMobileConfig)
      .catch(() =>
        setFeedbackBanner({
          type: 'error',
          text: 'No pudimos cargar las opciones del armario. Puedes continuar y volver a intentarlo más tarde.',
        }),
      );
  }, []);

  /**
   * Paso 1: Mostrar modal amable explicando por qué se pide permiso de Cámara o Galería.
   */
  const requestMediaCapture = (source: CaptureSource) => {
    setFeedbackBanner(null);
    setPermissionModalSource(source);
  };

  /**
   * Paso 2: Solicitar permiso real al SO y abrir Cámara o Galería completa de fotografías.
   */
  const handleConfirmPermissionAndPick = async () => {
    const source = permissionModalSource;
    setPermissionModalSource(null);
    if (!source) return;

    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          setFeedbackBanner({
            type: 'warning',
            text: 'Necesitamos tu permiso de Cámara para tomar la fotografía de la prenda.',
          });
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setLocalPhotoUri(asset.uri);
          setPhotoFileName(asset.fileName || `camara_${Date.now()}.jpg`);
          setPhotoMimeType(asset.mimeType || 'image/jpeg');
          setCaptureSource('camera');
          setScannedItem(null);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          setFeedbackBanner({
            type: 'warning',
            text: 'Necesitamos tu permiso de Galería para acceder a tus fotografías.',
          });
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setLocalPhotoUri(asset.uri);
          setPhotoFileName(asset.fileName || `galeria_${Date.now()}.jpg`);
          setPhotoMimeType(asset.mimeType || 'image/jpeg');
          setCaptureSource('gallery');
          setScannedItem(null);
        }
      }
    } catch (error: any) {
      setFeedbackBanner({
        type: 'error',
        text: error?.message || 'No se pudo abrir la cámara o galería.',
      });
    }
  };

  const handleSelectSubcategory = (sub: WardrobeSubcategory) => {
    setSubcategory(sub);
    const parentCategory = ALL_CATEGORIES.find((candidate) =>
      CATEGORY_SUBCATEGORIES[candidate].includes(sub),
    );
    setCategory(parentCategory || 'superior');
  };

  const handleSelectCategory = (nextCategory: WardrobeCategory) => {
    setCategory(nextCategory);
    if (!CATEGORY_SUBCATEGORIES[nextCategory].includes(subcategory)) {
      setSubcategory(CATEGORY_SUBCATEGORIES[nextCategory][0]);
    }
  };

  /**
   * Guarda y escanea la prenda en el armario personal (`POST /api/wardrobe/scan`).
   * Si falla la subida de la foto o aún no se adjuntó foto pero quiere conservarse el avance,
   * el backend (o el almacenamiento offline) conserva el borrador automáticamente.
   */
  const handleSaveToWardrobe = async (forceDraftWithoutPhoto = false) => {
    setFeedbackBanner(null);

    if (!category) {
      setFeedbackBanner({
        type: 'error',
        text: 'La categoría de la prenda es obligatoria.',
      });
      return;
    }

    if (!localPhotoUri && !forceDraftWithoutPhoto) {
      setFeedbackBanner({
        type: 'warning',
        text: 'La fotografía es obligatoria para confirmar la prenda. Toma una foto, elige de la galería o toca "Conservar como borrador".',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await wardrobeService.scanAndSaveGarment({
        photoUri: forceDraftWithoutPhoto ? null : localPhotoUri,
        photoFileName,
        photoMimeType,
        name: name.trim() || undefined,
        category,
        subcategory,
        color: color.trim() || undefined,
        approximateSize: approximateSize.trim() || undefined,
        season,
        occasion,
        captureSource,
        draftId: scannedItem?.id,
      });

      setScannedItem(response.item);
      // Actualizar campos con los atributos detectados automáticamente por el escaneo inteligente
      setName(response.item.name);
      setCategory(response.item.category);
      setSubcategory(response.item.subcategory);
      setColor(response.item.bottomDetails.color);
      setApproximateSize(response.item.bottomDetails.approximateSize);
      setOccasion(response.item.bottomDetails.occasion || undefined);

      if (response.savedAsDraft) {
        setFeedbackBanner({
          type: 'warning',
          text: response.message,
        });
        // El servicio ya guardó el borrador local/remoto; volver a la lista para que sea visible.
        setTimeout(() => {
          onSavedSuccess(response.item);
        }, 900);
      } else {
        setFeedbackBanner({
          type: 'success',
          text: response.message,
        });
        setTimeout(() => {
          onSavedSuccess(response.item);
        }, 900);
      }
    } catch (error: any) {
      setFeedbackBanner({
        type: 'error',
        text:
          error?.message ||
          'Ocurrió un problema al procesar la prenda. Intenta nuevamente.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const previewEnhancedUrl = scannedItem
    ? EnvConfig.resolveImageUrl(
        scannedItem.enhancedImageUrl || scannedItem.originalImageUrl,
      ) || localPhotoUri
    : localPhotoUri;

  return (
    <AtelierScreen
      subtitle="Registro Inteligente • HU-009"
      title="Nueva Prenda"
      rightSlot={
        <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancelar</Text>
        </TouchableOpacity>
      }
    >
      {/* Modal Guiado de Permisos de Cámara y Galería */}
      <PermissionGuideModal
        visible={permissionModalSource !== null}
        source={permissionModalSource}
        rationaleText={
          permissionModalSource === 'camera'
            ? mobileConfig?.permissionsRequired?.camera.rationale
            : mobileConfig?.permissionsRequired?.gallery.rationale
        }
        onConfirm={handleConfirmPermissionAndPick}
        onCancel={() => setPermissionModalSource(null)}
      />

      {/* Zona de Fotografía (Cámara / Galería + Vista Previa Mejorada Realista) */}
      <View style={styles.photoZoneCard}>
        <View style={styles.photoZoneHeader}>
          <View style={styles.studioPill}>
            <Text style={styles.studioPillText}>
              Fotografía de prenda
            </Text>
          </View>
          <Text style={styles.photoZoneHint}>Foto obligatoria *</Text>
        </View>

        <View style={styles.photoPreviewFrame}>
          {previewEnhancedUrl ? (
            <Image
              source={{ uri: previewEnhancedUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.emptyPhotoContent}>
              <Camera size={34} color={atelierColors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyPhotoTitle}>
                Captura o selecciona tu prenda
              </Text>
              <Text style={styles.emptyPhotoText}>
                Podrás registrar su color, tipo de corte y asignarla a su categoría en tu armario.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.captureButtonsRow}>
          <View style={styles.captureBtnCol}>
            <AtelierButton
              title="Tomar foto"
              icon={<Camera size={15} color={atelierColors.textPrimary} />}
              variant="outline"
              onPress={() => requestMediaCapture('camera')}
            />
          </View>
          <View style={styles.captureBtnCol}>
            <AtelierButton
              title="Galería"
              icon={<ImageIcon size={15} color={atelierColors.textPrimary} />}
              variant="outline"
              onPress={() => requestMediaCapture('gallery')}
            />
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.galleryNote}>
          Cuando el resultado mejorado esté listo, se guardará automáticamente en tu álbum BellAI.
        </Text>
      </View>

      {/* Banner de retroalimentación (Éxito, Borrador conservado o Advertencia) */}
      {feedbackBanner ? (
        <View
          style={[
            styles.bannerBox,
            feedbackBanner.type === 'success'
              ? styles.bannerSuccess
              : feedbackBanner.type === 'warning'
                ? styles.bannerWarning
                : styles.bannerError,
          ]}
        >
          <Text style={styles.bannerText}>{feedbackBanner.text}</Text>
        </View>
      ) : null}

      {/* Formulario de Datos de la Prenda */}
      <View style={styles.formCard}>
        <Text style={styles.sectionLabel}>
          Categoría principal (Obligatoria *)
        </Text>
        <View style={styles.chipsWrap}>
          {ALL_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                accessibilityRole="button"
                accessibilityLabel={`Categoría ${CATEGORY_LABELS[cat]}`}
                accessibilityState={{ selected: active }}
                onPress={() => handleSelectCategory(cat)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    active && styles.choiceChipTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>
          Tipo de prenda (Auto-clasificación inteligente)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalSubcategories}
        >
          {CATEGORY_SUBCATEGORIES[category].map((sub) => {
            const active = subcategory === sub;
            return (
              <TouchableOpacity
                key={sub}
                accessibilityRole="button"
                accessibilityLabel={`Tipo ${SUBCATEGORY_LABELS[sub]}`}
                accessibilityState={{ selected: active }}
                onPress={() => handleSelectSubcategory(sub)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    active && styles.choiceChipTextActive,
                  ]}
                >
                  {SUBCATEGORY_LABELS[sub]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <AtelierInput
          label="Nombre de la prenda (Opcional — se autogenera si lo dejas vacío)"
          placeholder="Ej. Blusa de Seda Azul Marino"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.twoColRow}>
          <View style={styles.halfCol}>
            <AtelierInput
              label="Color (Opcional / Auto)"
              placeholder="Ej. Azul Marino, Beige"
              value={color}
              onChangeText={setColor}
            />
          </View>
          <View style={styles.halfCol}>
            <AtelierInput
              label="Talla aproximada (Opcional)"
              placeholder="Ej. S, M, L, 38"
              value={approximateSize}
              onChangeText={setApproximateSize}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Ocasión (Opcional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalSubcategories}
        >
          {ALL_OCCASIONS.map((value) => {
            const active = occasion === value;
            return (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Ocasión ${OCCASION_LABELS[value]}`}
                accessibilityState={{ selected: active }}
                onPress={() => setOccasion(active ? undefined : value)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    active && styles.choiceChipTextActive,
                  ]}
                >
                  {OCCASION_LABELS[value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>Temporada (Opcional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalSubcategories}
        >
          {ALL_SEASONS.map((s) => {
            const active = season === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSeason(active ? undefined : s)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    active && styles.choiceChipTextActive,
                  ]}
                >
                  {SEASON_LABELS[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <AtelierButton
          title="Guardar en mi armario"
          icon={<Check size={16} color={atelierColors.surfaceWhite} />}
          loading={submitting}
          onPress={() => handleSaveToWardrobe(false)}
          style={styles.savePrimaryBtn}
        />

        <AtelierButton
          title="Conservar como borrador sin subir foto ahora"
          variant="secondary"
          disabled={submitting}
          onPress={() => handleSaveToWardrobe(true)}
        />
      </View>
    </AtelierScreen>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  cancelLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  photoZoneCard: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.xl,
    padding: 15,
    marginBottom: 14,
    ...atelierShadows.softCard,
  },
  photoZoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studioPill: {
    backgroundColor: atelierColors.roseBlush,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: atelierRadii.pill,
  },
  studioPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.terracottaDark,
  },
  photoZoneHint: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  photoPreviewFrame: {
    height: 220,
    backgroundColor: atelierColors.bgSilk,
    borderRadius: atelierRadii.lg,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyPhotoContent: {
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyPhotoIcon: {
    fontSize: ms(34),
    marginBottom: 8,
  },
  emptyPhotoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 5,
    textAlign: 'center',
  },
  emptyPhotoText: {
    fontSize: 12,
    color: atelierColors.mocha,
    textAlign: 'center',
    lineHeight: 18,
  },
  captureButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captureBtnCol: {
    width: '48.5%',
  },
  galleryNote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: atelierColors.textMuted,
    textAlign: 'center',
  },
  bannerBox: {
    padding: 12,
    borderRadius: atelierRadii.md,
    marginBottom: 14,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: atelierColors.sageLight,
    borderColor: atelierColors.sageBorder,
  },
  bannerWarning: {
    backgroundColor: atelierColors.amberLight,
    borderColor: atelierColors.amberBorder,
  },
  bannerError: {
    backgroundColor: atelierColors.burgundyLight,
    borderColor: atelierColors.burgundyBorder,
  },
  bannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.espresso,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.xl,
    padding: 16,
    ...atelierShadows.softCard,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.mocha,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  horizontalSubcategories: {
    paddingBottom: 14,
  },
  choiceChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: atelierRadii.pill,
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    marginRight: 8,
  },
  choiceChipActive: {
    backgroundColor: atelierColors.terracotta,
    borderColor: atelierColors.terracotta,
  },
  choiceChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  choiceChipTextActive: {
    color: atelierColors.onAccent,
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    width: '48.5%',
  },
  savePrimaryBtn: {
    marginTop: 6,
    marginBottom: 10,
  },
});
