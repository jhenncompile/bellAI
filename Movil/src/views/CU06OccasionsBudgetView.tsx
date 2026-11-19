import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Briefcase, Check, Coffee, Dumbbell, GraduationCap, Heart, PartyPopper } from 'lucide-react-native';
import { InputText } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralLink,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';

interface CU06OccasionsBudgetViewProps {
  onBack?: () => void;
  onFinish?: () => void;
}

const AVAILABLE_OCCASIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Trabajo', icon: Briefcase },
  { name: 'Universidad', icon: GraduationCap },
  { name: 'Fiesta', icon: PartyPopper },
  { name: 'Diario', icon: Coffee },
  { name: 'Cita', icon: Heart },
  { name: 'Deporte', icon: Dumbbell },
];

/** Ocasiones y presupuesto, paso 2 de 2 (sistema P1). */
export const CU06OccasionsBudgetView: React.FC<CU06OccasionsBudgetViewProps> = ({
  onBack,
  onFinish,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  // Sin valores previos: la usuaria elige.
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [budget, setBudget] = useState('');

  const toggleOccasion = (occasion: string) => {
    setSelectedOccasions((prev) => (prev.includes(occasion) ? prev.filter((o) => o !== occasion) : [...prev, occasion]));
  };

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.top}>
        {onBack ? <CoralBackButton label="Paso anterior" onPress={() => { hapticFeedback.light(); onBack(); }} /> : <View style={styles.spacer} />}
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Paso 2 de 2">
          {[1, 2].map((i) => (
            <View key={i} style={[styles.segment, { backgroundColor: c.hero[0] }]} />
          ))}
        </View>
        <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>2 de 2</Text>
      </View>

      <View style={styles.header}>
        <CoralTitle prefix="¿Dónde te " accent="mueves?" size={30} />
        <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>Así te proponemos looks para tus días reales.</Text>
      </View>

      <Appear style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Ocasiones frecuentes</Text>
        <View style={styles.list}>
          {AVAILABLE_OCCASIONS.map(({ name, icon: Icon }) => {
            const on = selectedOccasions.includes(name);
            return (
              <Pressable
                key={name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={name}
                onPress={() => { hapticFeedback.light(); toggleOccasion(name); }}
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
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Presupuesto por prenda</Text>
        <CoralCard radius={24}>
          <InputText
            {...field}
            label="Cuánto sueles gastar (opcional)"
            accessibilityLabel="Presupuesto por prenda en bolivianos"
            value={budget}
            onChangeText={(text) => setBudget(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            placeholder="Sin límite"
            helperText="En bolivianos, por prenda. Solo números positivos."
            leftIcon={<Text style={[coralText.strong, { color: iconColor }]}>Bs</Text>}
          />
        </CoralCard>
      </Appear>

      <View style={styles.footer}>
        <CoralButton
          title="Finalizar"
          onPress={() => { hapticFeedback.medium(); onFinish?.(); }}
          accessibilityLabel="Finalizar configuración de perfil y preferencias"
          fullWidth
        />
        {onBack ? <CoralLink title="Volver a estilos y colores" underline onPress={onBack} /> : null}
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
  footer: { marginTop: 'auto', paddingTop: 8, gap: 4, alignItems: 'center' },
});
