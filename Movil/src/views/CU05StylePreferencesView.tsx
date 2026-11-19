import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowRight, Ban, Check, Coffee, Crown, Feather, Flower2, Gem, Building2 } from 'lucide-react-native';
import { colors } from '@/shared/theme';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';

interface CU05StylePreferencesViewProps {
  onBack?: () => void;
  onContinue?: () => void;
}

const AVAILABLE_STYLES: { name: string; icon: LucideIcon }[] = [
  { name: 'Casual', icon: Coffee },
  { name: 'Clásico', icon: Crown },
  { name: 'Romántico', icon: Flower2 },
  { name: 'Minimalista', icon: Feather },
  { name: 'Urbano', icon: Building2 },
  { name: 'Elegante', icon: Gem },
];

// Colores de prenda que se eligen (contenido, no colores de la interfaz).
const PREFERRED_PALETTE = [
  { name: 'Cobre', hex: colors.palette.copper },
  { name: 'Café', hex: colors.palette.coffee },
  { name: 'Mostaza', hex: colors.palette.ochre },
  { name: 'Oliva', hex: colors.palette.olive },
  { name: 'Teja', hex: colors.palette.brick },
  { name: 'Crema', hex: colors.palette.cream },
];

const AVOID_PALETTE = [
  { name: 'Azul frío', hex: colors.palette.avoidCold },
  { name: 'Fucsia', hex: colors.palette.avoidPink },
  { name: 'Plata', hex: colors.palette.avoidSilver },
];

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Muestra de color pulsable con su nombre; la marca (✓ o prohibido) dice si está elegida, no solo el borde. */
function Swatch({ name, hex, on, avoid, onPress }: { name: string; hex: string; on: boolean; avoid?: boolean; onPress: () => void }) {
  const c = useCoral();
  const Mark = avoid ? Ban : Check;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={avoid ? `Evitar ${name}` : name}
      onPress={() => { hapticFeedback.light(); onPress(); }}
      style={({ pressed }) => [styles.swatchItem, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <View style={[styles.swatch, { backgroundColor: hex, borderColor: on ? c.ink : c.fieldStroke }]}>
        {on ? (
          <View style={[styles.mark, { backgroundColor: c.primary }]}>
            <Mark size={14} color={c.onPrimary} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text style={[coralText.caption, { fontFamily: on ? coralFonts.extrabold : coralFonts.semibold, color: c.ink }]}>{name}</Text>
    </Pressable>
  );
}

/** Preferencias de estilo, paso 1 de 2 (sistema P1). */
export const CU05StylePreferencesView: React.FC<CU05StylePreferencesViewProps> = ({
  onBack,
  onContinue,
}) => {
  const c = useCoral();
  // Sin selección previa: la usuaria elige.
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [avoidedColors, setAvoidedColors] = useState<string[]>([]);

  return (
    <CoralScreen contentStyle={styles.content}>
      <View style={styles.top}>
        {onBack ? <CoralBackButton onPress={() => { hapticFeedback.light(); onBack(); }} /> : <View style={styles.spacer} />}
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Paso 1 de 2">
          {[1, 2].map((i) => (
            <View key={i} style={[styles.segment, { backgroundColor: i <= 1 ? c.hero[0] : c.fieldStroke }]} />
          ))}
        </View>
        <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>1 de 2</Text>
      </View>

      <View style={styles.header}>
        <CoralTitle prefix="Cuéntanos tu " accent="estilo" size={30} />
        <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>Elige lo que te guste. Puedes cambiarlo después en tu perfil.</Text>
      </View>

      <Appear style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>¿Qué estilos te gustan?</Text>
        <View style={styles.list}>
          {AVAILABLE_STYLES.map(({ name, icon: Icon }) => {
            const on = selectedStyles.includes(name);
            return (
              <Pressable
                key={name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={name}
                onPress={() => { hapticFeedback.light(); setSelectedStyles((p) => toggle(p, name)); }}
                style={({ pressed }) => [
                  styles.option,
                  on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Icon size={22} color={on ? c.onPrimary : c.accent} strokeWidth={2} />
                <Text style={[coralText.strong, styles.optionLabel, { color: on ? c.onPrimary : c.ink }]}>{name}</Text>
                <View style={[styles.box, on ? { backgroundColor: c.onPrimary } : { borderColor: c.ink2, borderWidth: 1.5 }]}>
                  {on ? <Check size={18} color={c.primary} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Appear>

      <Appear delay={100} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Colores que prefieres</Text>
        <CoralCard radius={24}>
          <View style={styles.swatches}>
            {PREFERRED_PALETTE.map((color) => (
              <Swatch key={color.hex} name={color.name} hex={color.hex} on={selectedColors.includes(color.hex)} onPress={() => setSelectedColors((p) => toggle(p, color.hex))} />
            ))}
          </View>
        </CoralCard>
      </Appear>

      <Appear delay={160} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Colores que evitas</Text>
        <CoralCard radius={24}>
          <View style={styles.swatches}>
            {AVOID_PALETTE.map((color) => (
              <Swatch key={color.hex} name={color.name} hex={color.hex} avoid on={avoidedColors.includes(color.hex)} onPress={() => setAvoidedColors((p) => toggle(p, color.hex))} />
            ))}
          </View>
        </CoralCard>
      </Appear>

      <View style={styles.footer}>
        <CoralButton
          title="Continuar"
          onPress={() => { hapticFeedback.medium(); onContinue?.(); }}
          rightIcon={<ArrowRight size={18} color={c.onPrimary} strokeWidth={2.2} />}
          accessibilityLabel="Continuar al paso 2: ocasiones y presupuesto"
          fullWidth
        />
      </View>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  spacer: { width: 44, height: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 8 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  header: { gap: 6, paddingHorizontal: 8 },
  section: { gap: 12 },
  list: { gap: 10 },
  option: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  optionLabel: { flex: 1, fontSize: 15.5 },
  box: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 8 },
  swatchItem: { width: 64, minHeight: 44, alignItems: 'center', gap: 6 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'flex-end', justifyContent: 'flex-end' },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: -4, marginBottom: -4 },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
