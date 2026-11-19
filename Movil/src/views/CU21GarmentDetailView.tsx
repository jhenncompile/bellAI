import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, CircleCheck, Pencil, Shirt, Trash2 } from 'lucide-react-native';
import { Banner, ButtonDanger, ButtonSecondary, Dialog } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralChip,
  CoralScreen,
  CoralTitle,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';

interface CU21GarmentDetailViewProps {
  garmentName: string;
  category?: string;
  color?: string;
  colorHex?: string | null;
  occasion?: string;
  timesWorn?: number;
  photoUri?: string | null;
  /** `false` si la prenda aún no se puede marcar como usada (borrador sin sincronizar). */
  canWear?: boolean;
  /** Se acaba de registrar un uso. */
  wornToday?: boolean;
  wearing?: boolean;
  deleting?: boolean;
  /** Problema de la última acción, ya en lenguaje humano. */
  errorMessage?: string;
  onBack?: () => void;
  onMarkWorn?: () => void;
  onEditGarment?: () => void;
  onDeleteConfirm?: () => void;
}

const usageLabel = (n: number) => (n === 0 ? 'Sin estrenar' : n === 1 ? 'Usada 1 vez' : `Usada ${n} veces`);

/** CU-21 · Detalle de una prenda: registrar uso, editar o eliminar. */
export const CU21GarmentDetailView: React.FC<CU21GarmentDetailViewProps> = ({
  garmentName,
  category,
  color,
  colorHex,
  occasion,
  timesWorn,
  photoUri,
  canWear = true,
  wornToday = false,
  wearing = false,
  deleting = false,
  errorMessage,
  onBack,
  onMarkWorn,
  onEditGarment,
  onDeleteConfirm,
}) => {
  const c = useCoral();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Cierra el diálogo cuando termina el borrado (con éxito o con error)
  const [wasDeleting, setWasDeleting] = useState(deleting);
  if (deleting !== wasDeleting) {
    setWasDeleting(deleting);
    if (!deleting) setConfirmDelete(false);
  }
  const busy = wearing || deleting;

  return (
    <CoralScreen contentStyle={styles.content}>
      {onBack ? (
        <View style={styles.head}>
          <CoralBackButton onPress={onBack} label="Volver al armario" />
        </View>
      ) : null}

      <Appear>
        <View style={styles.photo}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.fill} resizeMode="cover" accessibilityLabel={`Foto de ${garmentName}`} />
          ) : (
            <LinearGradient colors={c.tiles[1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, styles.center]}>
              <Shirt size={56} color={c.ink} strokeWidth={1.6} />
            </LinearGradient>
          )}
        </View>
      </Appear>

      <View style={styles.info}>
        <CoralTitle prefix={garmentName} size={28} />
        <View style={styles.chips}>
          {category ? <CoralChip label={category} /> : null}
          {color ? (
            <CoralChip
              label={color}
              icon={colorHex ? <View style={[styles.dot, { backgroundColor: colorHex, borderColor: c.fieldStroke }]} /> : undefined}
            />
          ) : null}
          {occasion ? <CoralChip label={occasion} /> : null}
        </View>
        {typeof timesWorn === 'number' ? (
          <Text accessibilityLiveRegion="polite" style={[coralText.body, { color: c.ink2 }]}>{usageLabel(timesWorn)}</Text>
        ) : null}
      </View>

      {errorMessage ? <Banner kind="error" title="No pudimos completar la acción" description={errorMessage} /> : null}

      {wornToday ? (
        <View accessibilityLiveRegion="polite" style={[styles.done, { backgroundColor: c.muted }]}>
          <CircleCheck size={20} color={c.ink} strokeWidth={2.3} />
          <Text style={[coralText.label, styles.flex, { color: c.ink }]}>Anotado: la usaste hoy.</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onMarkWorn ? (
          <CoralButton
            title="La usé hoy"
            onPress={onMarkWorn}
            loading={wearing}
            disabled={!canWear || busy}
            accessibilityHint={canWear ? 'Suma un uso a esta prenda' : 'Disponible cuando la prenda se sincronice'}
            leftIcon={<CalendarCheck size={20} color={c.onPrimary} strokeWidth={2.2} />}
            fullWidth
          />
        ) : null}
        {onMarkWorn && !canWear ? (
          <Text style={[coralText.small, styles.centerText, { color: c.ink2 }]}>
            Podrás anotar sus usos cuando la prenda se sincronice.
          </Text>
        ) : null}
        {onEditGarment ? (
          <CoralButton
            title="Editar"
            variant="secondary"
            height={44}
            onPress={onEditGarment}
            disabled={busy}
            accessibilityLabel="Editar la prenda"
            leftIcon={<Pencil size={18} color={c.ink} strokeWidth={2.2} />}
            fullWidth
          />
        ) : null}
        {onDeleteConfirm ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eliminar del armario"
            accessibilityHint="Te pediremos confirmación"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => { hapticFeedback.medium(); setConfirmDelete(true); }}
            style={({ pressed }) => [styles.danger, (pressed || busy) && { opacity: 0.6 }]}
          >
            <Trash2 size={18} color={c.danger} strokeWidth={2.2} />
            <Text style={[coralText.label, { fontSize: 15.5, color: c.danger, textDecorationLine: 'underline' }]}>Eliminar del armario</Text>
          </Pressable>
        ) : null}
      </View>

      <Dialog
        visible={confirmDelete}
        onClose={() => { if (!deleting) setConfirmDelete(false); }}
        titlePrefix="¿Eliminar esta "
        titleAccent="prenda?"
        description={`«${garmentName}» saldrá de tu armario. No se puede deshacer.`}
        actions={
          <>
            <ButtonDanger
              title="Eliminar"
              onPress={() => onDeleteConfirm?.()}
              loading={deleting}
              disabled={deleting}
              accessibilityLabel="Confirmar: eliminar la prenda"
            />
            <ButtonSecondary title="Cancelar" onPress={() => setConfirmDelete(false)} disabled={deleting} />
          </>
        }
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  content: { gap: 18 },
  head: { flexDirection: 'row' },
  photo: { height: 320, borderRadius: 28, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  info: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18 },
  actions: { gap: 10 },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, alignSelf: 'center', paddingHorizontal: 8 },
});
