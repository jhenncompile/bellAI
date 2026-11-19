import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { LucideIcon } from 'lucide-react-native';
import {
  Briefcase,
  Calendar,
  Camera,
  Check,
  Coffee,
  Gem,
  Heart,
  Moon,
  Scissors,
  Shirt,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import { Banner, InputText, TextArea } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import { friendlyMessage } from '@/shared/api/http';
import { AuraGoal, AestheticStyle, UsualOccasion } from '@/entities/user/model/types';
import type { ProfileFormValues } from '@/features/profile/api/profileService';

interface CU07ProfilePreferencesViewProps {
  initialValues: ProfileFormValues;
  onBack?: () => void;
  onSaveChanges: (updated: ProfileFormValues) => Promise<void>;
  onUploadAvatar: (uri: string, fileName: string, mimeType: string) => Promise<string>;
}

// Mismas opciones e iconos que la bienvenida guiada.
const GOALS: { value: AuraGoal; icon: LucideIcon }[] = [
  { value: 'Vestirme mejor', icon: Shirt },
  { value: 'Encontrar mi estilo', icon: Sparkles },
  { value: 'Cambiar mi imagen', icon: Scissors },
  { value: 'Vestirme para ocasiones', icon: Calendar },
  { value: 'Aprovechar mi armario', icon: Heart },
];

const STYLES: AestheticStyle[] = [
  'Old Money Chic',
  'Clean Girl Aesthetic',
  'Minimalista Sofisticado',
  'Dark Academia',
  'Romántico Clásico',
  'Streetwear / Urbano',
  'Quiet Luxury',
  'Y2K Glam',
];

const OCCASIONS: { value: UsualOccasion; icon: LucideIcon }[] = [
  { value: 'Trabajo / Oficina', icon: Briefcase },
  { value: 'Casual Diario', icon: Coffee },
  { value: 'Eventos Formales', icon: Gem },
  { value: 'Salidas Nocturnas', icon: Moon },
  { value: 'Citas / Eventos Sociales', icon: Heart },
];

const splitValues = (value: string): string[] =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/** Opción en fila: icono, texto y casilla. Elegida, va en tinta. */
function OptionRow({ label, Icon, on, onPress }: { label: string; Icon: LucideIcon; on: boolean; onPress: () => void }) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => { hapticFeedback.light(); onPress(); }}
      style={({ pressed }) => [
        styles.option,
        on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <Icon size={22} color={on ? c.onPrimary : c.accent} strokeWidth={2} />
      <Text style={[coralText.strong, styles.optionLabel, { color: on ? c.onPrimary : c.ink }]}>{label}</Text>
      <View style={[styles.box, on ? { backgroundColor: c.onPrimary } : { borderColor: c.ink2, borderWidth: 1.5 }]}>
        {on ? <Check size={18} color={c.primary} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

/** Opción en píldora, para listas largas de estilos. */
function OptionChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => { hapticFeedback.light(); onPress(); }}
      style={({ pressed }) => [
        styles.chip,
        on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
      <Text style={[coralText.label, { color: on ? c.onPrimary : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const c = useCoral();
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text accessibilityRole="header" style={[coralText.label, { color: c.ink }]}>{title}</Text>
        {hint ? <Text style={[coralText.caption, { color: c.ink2 }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Editar perfil (sistema P1): foto, datos personales y preferencias que usan las recomendaciones. */
export const CU07ProfilePreferencesView: React.FC<CU07ProfilePreferencesViewProps> = ({
  initialValues,
  onBack,
  onSaveChanges,
  onUploadAvatar,
}) => {
  const c = useCoral();
  const { iconColor: _unused, ...field } = useCoralFieldStyles();
  const [name, setName] = useState(initialValues.name);
  const [email, setEmail] = useState(initialValues.email);
  const [phone, setPhone] = useState(initialValues.phone);
  const [bio, setBio] = useState(initialValues.bio);
  const [address, setAddress] = useState(initialValues.address);
  const [birthDate, setBirthDate] = useState(initialValues.birthDate);
  const [goals, setGoals] = useState<string[]>(initialValues.stylePreferences.goals || []);
  const [preferredStyles, setPreferredStyles] = useState<string[]>(initialValues.stylePreferences.preferredStyles || []);
  const [dislikedStyles, setDislikedStyles] = useState<string[]>(initialValues.stylePreferences.dislikedStyles || []);
  const [occasions, setOccasions] = useState<string[]>(initialValues.stylePreferences.occasions || []);
  const [preferredColors, setPreferredColors] = useState((initialValues.stylePreferences.preferredColors || []).join(', '));
  const [avoidedColors, setAvoidedColors] = useState((initialValues.stylePreferences.avoidedColors || []).join(', '));
  const [budget, setBudget] = useState(initialValues.stylePreferences.budgetPerGarment?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(initialValues.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);
      setAvatarError('');
      const savedUrl = await onUploadAvatar(
        asset.uri,
        asset.fileName || `avatar_${Date.now()}.jpg`,
        asset.mimeType || 'image/jpeg',
      );
      setAvatarUrl(savedUrl);
      hapticFeedback.success();
    } catch (uploadError) {
      setAvatarError(friendlyMessage(uploadError, 'Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      setError('El nombre y el correo son necesarios para guardar el perfil.');
      return;
    }
    const budgetValue = budget.trim() ? Number(budget) : null;
    if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0 || budgetValue > 1_000_000)) {
      setError('El presupuesto debe ser un número entre 0 y 1.000.000 Bs.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSaveChanges({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        avatarUrl,
        phone: phone.trim(),
        bio: bio.trim(),
        address: address.trim(),
        birthDate: birthDate.trim(),
        stylePreferences: {
          goals,
          preferredStyles,
          dislikedStyles,
          occasions,
          preferredColors: splitValues(preferredColors),
          avoidedColors: splitValues(avoidedColors),
          budgetPerGarment: budgetValue,
        },
      });
      hapticFeedback.success();
    } catch (saveError) {
      setError(friendlyMessage(saveError, 'No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.top}>
        {onBack ? (
          <CoralBackButton label="Volver al perfil" disabled={saving} onPress={() => { hapticFeedback.light(); onBack(); }} />
        ) : null}
      </View>

      <View style={styles.header}>
        <CoralTitle prefix="Editar " accent="perfil" size={30} />
        <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>
          Lo que elijas aquí ajusta tus recomendaciones de colores, prendas y outfits.
        </Text>
      </View>

      <Appear>
        <CoralCard radius={24} padding={14}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            accessibilityHint="Abre tu galería para elegir una imagen"
            accessibilityState={{ disabled: uploadingAvatar, busy: uploadingAvatar }}
            disabled={uploadingAvatar}
            onPress={() => { void handlePickAvatar(); }}
            style={({ pressed }) => [styles.avatarPicker, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.avatar, { backgroundColor: c.primary }]}>
              {uploadingAvatar ? (
                <ActivityIndicator color={c.onPrimary} accessibilityLabel="Subiendo foto" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <UserRound size={30} color={c.onPrimary} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={[coralText.strong, { color: c.ink }]}>{uploadingAvatar ? 'Subiendo foto…' : 'Foto de perfil'}</Text>
              <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>Toca para elegir una imagen cuadrada.</Text>
            </View>
            <View style={[styles.iconCircle, { backgroundColor: c.muted }]}>
              <Camera size={20} color={c.ink} strokeWidth={2.2} />
            </View>
          </Pressable>
        </CoralCard>
      </Appear>
      {avatarError ? <Banner kind="error" title="No se pudo actualizar la foto" description={avatarError} /> : null}

      <Appear delay={80} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Datos personales</Text>
        <CoralCard radius={24} style={styles.fields}>
          <InputText {...field} label="Nombre completo" required value={name} onChangeText={setName} autoComplete="name" />
          <InputText
            {...field}
            label="Correo electrónico"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <InputText {...field} label="Teléfono (opcional)" placeholder="Agrega tu número" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <InputText {...field} label="Fecha de nacimiento (opcional)" placeholder="AAAA-MM-DD" value={birthDate} onChangeText={setBirthDate} />
          <InputText {...field} label="Dirección (opcional)" placeholder="Agrega tu dirección" value={address} onChangeText={setAddress} />
          <TextArea
            {...field}
            label="Sobre mí (opcional)"
            placeholder="Cuéntanos algo sobre ti"
            value={bio}
            onChangeText={setBio}
            minHeight={96}
            maxLength={500}
          />
        </CoralCard>
      </Appear>

      <Appear delay={140} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Preferencias</Text>
        <Group title="Qué quieres lograr" hint="Elige una o varias.">
          <View style={styles.list}>
            {GOALS.map((g) => (
              <OptionRow key={g.value} label={g.value} Icon={g.icon} on={goals.includes(g.value)} onPress={() => setGoals((p) => toggle(p, g.value))} />
            ))}
          </View>
        </Group>
        <Group title="Estilos que prefieres">
          <View style={styles.chips}>
            {STYLES.map((s) => (
              <OptionChip key={s} label={s} on={preferredStyles.includes(s)} onPress={() => setPreferredStyles((p) => toggle(p, s))} />
            ))}
          </View>
        </Group>
        <Group title="Estilos que quieres evitar" hint="No te los recomendaremos.">
          <View style={styles.chips}>
            {STYLES.map((s) => (
              <OptionChip key={s} label={s} on={dislikedStyles.includes(s)} onPress={() => setDislikedStyles((p) => toggle(p, s))} />
            ))}
          </View>
        </Group>
        <Group title="Para qué ocasiones te vistes">
          <View style={styles.list}>
            {OCCASIONS.map((o) => (
              <OptionRow key={o.value} label={o.value} Icon={o.icon} on={occasions.includes(o.value)} onPress={() => setOccasions((p) => toggle(p, o.value))} />
            ))}
          </View>
        </Group>
        <CoralCard radius={24} style={styles.fields}>
          <InputText
            {...field}
            label="Colores que prefieres (opcional)"
            placeholder="Ej. #B5651D, #F5F0E8"
            helperText="Sepáralos con comas."
            value={preferredColors}
            onChangeText={setPreferredColors}
            autoCapitalize="none"
          />
          <InputText
            {...field}
            label="Colores que quieres evitar (opcional)"
            placeholder="Ej. #FF0000, #000000"
            helperText="Sepáralos con comas."
            value={avoidedColors}
            onChangeText={setAvoidedColors}
            autoCapitalize="none"
          />
          <InputText
            {...field}
            label="Presupuesto por prenda en Bs (opcional)"
            placeholder="Sin límite"
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
          />
        </CoralCard>
      </Appear>

      {error ? <Banner kind="error" title="No se guardaron los cambios" description={error} /> : null}

      <CoralButton
        title="Guardar cambios"
        onPress={() => { void handleSave(); }}
        loading={saving}
        disabled={saving}
        accessibilityLabel="Guardar cambios de perfil y preferencias"
        fullWidth
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 18 },
  top: { minHeight: 44, flexDirection: 'row' },
  header: { gap: 6, paddingHorizontal: 8 },
  section: { gap: 14 },
  fields: { gap: 4 },
  avatarPicker: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 10 },
  groupHead: { gap: 2, paddingHorizontal: 4 },
  list: { gap: 10 },
  option: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  optionLabel: { flex: 1, fontSize: 15.5 },
  box: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
});
