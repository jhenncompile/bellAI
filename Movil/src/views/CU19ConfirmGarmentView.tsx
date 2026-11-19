import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, CircleAlert, ScanSearch, Shirt } from 'lucide-react-native';
import { Banner, Chip, InputText } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  ExtractedColor,
  GarmentAnalysisResult,
} from '@/features/digital-wardrobe/services/garmentImageAnalyzer';
import {
  SUBCATEGORY_TO_CATEGORY,
  WardrobeCategory,
  WardrobeSubcategory,
} from '@/features/digital-wardrobe/types/wardrobe.types';

/** Valores de una prenda existente para editarla (CU-21 → CU-19). */
export interface GarmentInitialValues {
  name: string;
  subcategory?: WardrobeSubcategory | null;
  color: string;
  colorHex?: string | null;
}

interface CU19ConfirmGarmentViewProps {
  analysis?: GarmentAnalysisResult | null;
  photoUri?: string;
  /** `edit`: prellena con `initialValues` y no muestra el aviso del análisis. */
  mode?: 'create' | 'edit';
  initialValues?: GarmentInitialValues | null;
  saving?: boolean;
  /** Error al guardar, ya en lenguaje humano. */
  errorMessage?: string;
  onBack?: () => void;
  onSaveGarment?: (data: ConfirmedGarmentData) => void;
}

/** Datos confirmados por la usuaria en CU-19 (lo propuesto, ya revisado o corregido). */
export interface ConfirmedGarmentData {
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  color: string;
  /** `null` si la usuaria escribió un color sin elegir ninguna muestra de la foto. */
  colorHex: string | null;
  name: string;
  photoUri?: string;
}

/** HU-15: tipos agrupados como los entiende la usuaria; cada opción es una subcategoría del servicio. */
const TYPE_GROUPS: { key: string; label: string; subs: WardrobeSubcategory[] }[] = [
  { key: 'superior', label: 'Superior', subs: ['blusas', 'camisas', 'camisetas', 'tops'] },
  { key: 'inferior', label: 'Inferior', subs: ['pantalones', 'jeans', 'faldas', 'shorts'] },
  // «Vestido» se guarda como categoría superior, subcategoría vestidos (SUBCATEGORY_TO_CATEGORY)
  { key: 'vestido', label: 'Vestido', subs: ['vestidos'] },
  { key: 'abrigo', label: 'Abrigo', subs: ['chaquetas', 'abrigos', 'sueteres', 'blazers'] },
  { key: 'calzado', label: 'Calzado', subs: ['zapatillas', 'tacones', 'botas', 'sandalias'] },
  { key: 'accesorio', label: 'Accesorio', subs: ['bolsos', 'cinturones', 'joyeria', 'sombreros', 'bufandas', 'lentes', 'relojes'] },
];

/** Nombre en singular de cada subtipo, para los chips y el nombre por defecto. */
const SINGULAR: Partial<Record<WardrobeSubcategory, string>> = {
  blusas: 'Blusa', camisas: 'Camisa', camisetas: 'Camiseta', tops: 'Top',
  pantalones: 'Pantalón', jeans: 'Jean', faldas: 'Falda', shorts: 'Short',
  vestidos: 'Vestido',
  chaquetas: 'Chaqueta', abrigos: 'Abrigo', sueteres: 'Suéter', blazers: 'Blazer',
  zapatillas: 'Zapatillas', tacones: 'Tacones', botas: 'Botas', sandalias: 'Sandalias',
  bolsos: 'Bolso', cinturones: 'Cinturón', joyeria: 'Joyería', sombreros: 'Sombrero',
  bufandas: 'Bufanda', lentes: 'Lentes', relojes: 'Reloj', otros: 'Prenda',
};

const groupOf = (sub: WardrobeSubcategory | null | undefined) =>
  sub ? TYPE_GROUPS.find((g) => g.subs.includes(sub))?.key ?? null : null;

/** CU-19 · Confirmar (o editar) el tipo y el color de una prenda. */
export const CU19ConfirmGarmentView: React.FC<CU19ConfirmGarmentViewProps> = ({
  analysis,
  photoUri: propPhotoUri,
  mode = 'create',
  initialValues,
  saving = false,
  errorMessage,
  onBack,
  onSaveGarment,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const editing = mode === 'edit';

  const photoUri = analysis?.photoUri || propPhotoUri;
  const suggestion = editing ? null : analysis?.typeSuggestion ?? null;
  const detected = !editing && (analysis?.status === 'completo' || analysis?.status === 'parcial');

  // Lo propuesto (o lo guardado, al editar) llega preseleccionado y se puede corregir
  const [selectedSub, setSelectedSub] = useState<WardrobeSubcategory | null>(
    (editing ? initialValues?.subcategory : suggestion?.subcategory) ?? null,
  );
  const [selectedGroup, setSelectedGroup] = useState<string | null>(groupOf(selectedSub));
  const [selectedHex, setSelectedHex] = useState<string | null>(
    (editing ? initialValues?.colorHex : analysis?.dominantColor?.hex) ?? null,
  );
  const [colorName, setColorName] = useState((editing ? initialValues?.color : analysis?.colorName) ?? '');
  const [garmentName, setGarmentName] = useState(editing ? initialValues?.name ?? '' : '');

  const palette: ExtractedColor[] = editing ? [] : (analysis?.palette ?? []).slice(0, 4);
  const activeGroup = TYPE_GROUPS.find((g) => g.key === selectedGroup) ?? null;

  const missing: string[] = [];
  if (!selectedSub) missing.push(selectedGroup ? 'elige qué prenda es' : 'elige el tipo');
  if (!colorName.trim()) missing.push('escribe el color');
  const canSave = missing.length === 0;
  const missingText = canSave ? '' : `Para guardar, ${missing.join(' y ')}.`;

  const handleSelectGroup = (key: string) => {
    setSelectedGroup(key);
    const group = TYPE_GROUPS.find((g) => g.key === key);
    if (!group || (selectedSub && group.subs.includes(selectedSub))) return;
    // Un grupo con una sola opción (vestido) queda resuelto; en los demás se elige la prenda exacta
    setSelectedSub(group.subs.length === 1 ? group.subs[0] : null);
  };

  const handleSelectColor = (swatch: ExtractedColor, label: string) => {
    hapticFeedback.light();
    setSelectedHex(swatch.hex);
    setColorName(swatch.name || label);
  };

  const handleSave = () => {
    if (!selectedSub || !canSave || saving) return;
    hapticFeedback.medium();
    const color = colorName.trim();
    onSaveGarment?.({
      category: SUBCATEGORY_TO_CATEGORY[selectedSub],
      subcategory: selectedSub,
      color,
      colorHex: selectedHex,
      name: garmentName.trim() || `${SINGULAR[selectedSub] ?? 'Prenda'} ${color.toLocaleLowerCase()}`,
      photoUri,
    });
  };

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.head}>
        {onBack ? <CoralBackButton onPress={onBack} label={editing ? 'Cancelar la edición' : 'Volver a la cámara'} disabled={saving} /> : null}
        <CoralTitle prefix={editing ? 'Editar ' : 'Nueva '} accent="prenda" size={28} style={styles.flex} />
      </View>

      <Appear>
        <View style={styles.photo}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.fill} resizeMode="cover" accessibilityLabel="Foto de la prenda" />
          ) : (
            <LinearGradient colors={c.tiles[0]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, styles.center]}>
              <Shirt size={44} color={c.ink} strokeWidth={1.8} />
            </LinearGradient>
          )}
        </View>
      </Appear>

      {!editing ? (
        <View accessibilityRole="summary" style={[styles.note, { backgroundColor: c.muted }]}>
          {detected ? <ScanSearch size={20} color={c.ink} /> : <CircleAlert size={20} color={c.ink} />}
          <View style={styles.flex}>
            <Text style={[coralText.strong, { color: c.ink }]}>{detected ? 'Revisa lo que detectamos' : 'Elige el tipo y el color'}</Text>
            <Text style={[coralText.small, { color: c.ink2 }]}>
              {detected
                ? suggestion?.confidence === 'media'
                  ? 'No estamos seguros del tipo. Corrígelo si no coincide.'
                  : 'Corrige el tipo o el color si no coinciden.'
                : 'No pudimos reconocerlos en la foto.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Tipo */}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Tipo</Text>
        <View style={styles.chips}>
          {TYPE_GROUPS.map((group) => (
            <Chip key={group.key} label={group.label} active={selectedGroup === group.key} onPress={() => handleSelectGroup(group.key)} />
          ))}
        </View>
        {activeGroup && activeGroup.subs.length > 1 ? (
          <View style={styles.chips}>
            {activeGroup.subs.map((sub) => (
              <Chip key={sub} label={SINGULAR[sub] ?? sub} active={selectedSub === sub} onPress={() => setSelectedSub(sub)} showCheck={false} />
            ))}
          </View>
        ) : null}
      </View>

      {/* Color */}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Color</Text>
        {palette.length > 0 ? (
          <View style={styles.swatches}>
            {palette.map((swatch, index) => {
              const label = swatch.name || `Tono ${index + 1}`;
              const selected = swatch.hex === selectedHex;
              return (
                <Pressable
                  key={`${swatch.hex}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar ${label} como color de la prenda`}
                  accessibilityState={{ selected }}
                  onPress={() => handleSelectColor(swatch, label)}
                  style={[styles.swatch, { backgroundColor: c.card, borderColor: selected ? c.ink : c.fieldStroke }]}
                >
                  <View style={[styles.circle, { backgroundColor: swatch.hex, borderColor: c.fieldStroke }]}>
                    {selected ? <Check size={14} color={swatch.rgb.r + swatch.rgb.g + swatch.rgb.b > 540 ? c.ink : '#FFFFFF'} strokeWidth={3} /> : null}
                  </View>
                  <Text numberOfLines={2} style={[coralText.caption, styles.centerText, { color: c.ink, fontFamily: selected ? coralFonts.extrabold : coralFonts.semibold }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <InputText
          {...field}
          label={palette.length > 0 ? 'Corrige el nombre si hace falta' : 'Nombre del color'}
          value={colorName}
          onChangeText={setColorName}
          placeholder="Ej.: azul marino"
          autoCapitalize="sentences"
          leftIcon={selectedHex ? <View style={[styles.fieldDot, { backgroundColor: selectedHex, borderColor: c.fieldStroke }]} /> : undefined}
        />
      </View>

      {/* Nombre */}
      <View style={styles.section}>
        <InputText
          {...field}
          label="Nombre (opcional)"
          value={garmentName}
          onChangeText={setGarmentName}
          placeholder={selectedSub && colorName.trim() ? `${SINGULAR[selectedSub] ?? 'Prenda'} ${colorName.trim().toLocaleLowerCase()}` : 'Ej.: blusa de lino'}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
      </View>

      {errorMessage ? <Banner kind="error" title="No pudimos guardar la prenda" description={errorMessage} /> : null}

      <View style={styles.actions}>
        <CoralButton
          title={editing ? 'Guardar cambios' : 'Guardar en mi armario'}
          onPress={handleSave}
          disabled={!canSave || saving}
          loading={saving}
          accessibilityHint={missingText || undefined}
          fullWidth
        />
        {missingText ? (
          <Text accessibilityLiveRegion="polite" style={[coralText.small, styles.centerText, { color: c.ink2 }]}>{missingText}</Text>
        ) : null}
      </View>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  content: { gap: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { height: 200, borderRadius: 24, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 18, borderWidth: 1.5 },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fieldDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
  actions: { gap: 8, marginTop: 4 },
});
