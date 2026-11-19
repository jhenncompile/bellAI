import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  Coffee,
  Gem,
  Heart,
  Moon,
  Scissors,
  Shirt,
  Sparkles,
} from 'lucide-react-native';
import {
  AuraGoal,
  AestheticStyle,
  UsualOccasion,
  UserProfile,
} from '@/entities/user/model/types';
import { hapticFeedback } from '@/shared/lib/haptics';
import { Banner, NoticeOutlet } from '@/shared/ui/Notice';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralLink,
  CoralScreen,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { ms } from '@/shared/theme/tokens/responsive';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: UserProfile) => void;
  /** Mensaje si no se pudieron guardar las preferencias (la pantalla sigue abierta para reintentar). */
  errorMessage?: string;
}

const GOALS: { value: AuraGoal; label: string; icon: LucideIcon }[] = [
  { value: 'Vestirme mejor', label: 'Vestirme mejor cada día', icon: Shirt },
  { value: 'Encontrar mi estilo', label: 'Encontrar mi estilo', icon: Sparkles },
  { value: 'Cambiar mi imagen', label: 'Cambiar mi imagen', icon: Scissors },
  { value: 'Vestirme para ocasiones', label: 'Vestirme para ocasiones', icon: Calendar },
  { value: 'Aprovechar mi armario', label: 'Aprovechar mi armario', icon: Heart },
];

const STYLES: AestheticStyle[] = [
  'Old Money Chic',
  'Clean Girl Aesthetic',
  'Minimalista Sofisticado',
  'Quiet Luxury',
  'Romántico Clásico',
  'Dark Academia',
  'Streetwear / Urbano',
  'Y2K Glam',
];

const OCCASIONS: { value: UsualOccasion; icon: LucideIcon }[] = [
  { value: 'Trabajo / Oficina', icon: Briefcase },
  { value: 'Casual Diario', icon: Coffee },
  { value: 'Eventos Formales', icon: Gem },
  { value: 'Salidas Nocturnas', icon: Moon },
  { value: 'Citas / Eventos Sociales', icon: Heart },
];

const STEPS = {
  1: { bubble: '¡Hola! Te haré 3 preguntas cortas para conocer tu estilo.', question: '¿Qué quieres lograr con BellAI?' },
  2: { bubble: '¡Genial! Ahora cuéntame qué estéticas te inspiran.', question: '¿Qué estilos te inspiran?' },
  3: { bubble: 'Última pregunta y te muestro tu inicio.', question: '¿Para qué ocasiones te vistes?' },
} as const;

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * Bienvenida guiada (propuesta P1): tres preguntas a pantalla completa, con barra de avance,
 * la mascota como guía, opciones con icono y casilla, una acción principal y «Omitir por ahora».
 */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onComplete, errorMessage }) => {
  const c = useCoral();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goals, setGoals] = useState<AuraGoal[]>(['Vestirme mejor', 'Encontrar mi estilo']);
  const [styles_, setStyles] = useState<AestheticStyle[]>(['Old Money Chic', 'Quiet Luxury']);
  const [occasions, setOccasions] = useState<UsualOccasion[]>(['Casual Diario', 'Trabajo / Oficina']);

  const finish = (picked: { goals: AuraGoal[]; styles: AestheticStyle[]; occasions: UsualOccasion[] }) => {
    onComplete({
      id: `usr_${Date.now()}`,
      name: 'Usuario Bella',
      goals: picked.goals,
      preferredStyles: picked.styles,
      dislikedStyles: [],
      occasions: picked.occasions,
      isOnboarded: true,
      createdAt: new Date().toISOString(),
    });
  };

  const next = () => {
    hapticFeedback.medium();
    if (step < 3) setStep((step + 1) as 2 | 3);
    else finish({ goals, styles: styles_, occasions });
  };

  // Omitir guarda el perfil sin preferencias; se pueden elegir después desde el perfil.
  const skip = () => {
    hapticFeedback.light();
    finish({ goals: [], styles: [], occasions: [] });
  };

  const selected = step === 1 ? goals.length : step === 2 ? styles_.length : occasions.length;

  const renderRow = (key: string, label: string, Icon: LucideIcon, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (step > 1 ? setStep((step - 1) as 1 | 2) : undefined)}>
      <CoralScreen contentStyle={styles.content}>
        <View style={styles.top}>
          {step > 1 ? (
            <CoralBackButton label="Pregunta anterior" onPress={() => setStep((step - 1) as 1 | 2)} />
          ) : <View style={styles.backSpacer} />}
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Pregunta ${step} de 3`}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.segment, { backgroundColor: i <= step ? c.hero[0] : c.fieldStroke }]} />
            ))}
          </View>
          <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>{step} de 3</Text>
        </View>

        <View style={styles.guide}>
          <Mascot key={`m${step}`} pose="corazon" height={74} enter="pop" />
          <Appear key={`b${step}`} delay={120} style={styles.bubble}>
          <CoralCard radius={20} padding={14}>
            <Text style={[coralText.small, { color: c.ink }]} accessibilityLiveRegion="polite">{STEPS[step].bubble}</Text>
          </CoralCard>
          </Appear>
        </View>

        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.question, { color: c.ink }]}>{STEPS[step].question}</Text>
          <Text style={[coralText.body, { fontSize: 14.5, lineHeight: 20, color: c.ink2 }]}>
            Elige una o varias. Puedes cambiarlo después en tu perfil.
          </Text>
        </View>

        <Appear key={`o${step}`} delay={200}>
        {step === 1 ? (
          <View style={styles.list}>
            {GOALS.map((g) => renderRow(g.value, g.label, g.icon, goals.includes(g.value), () => setGoals((p) => toggle(p, g.value))))}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.chips}>
            {STYLES.map((s) => {
              const on = styles_.includes(s);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => { hapticFeedback.light(); setStyles((p) => toggle(p, s)); }}
                  style={({ pressed }) => [
                    styles.chip,
                    on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                >
                  {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
                  <Text style={[coralText.label, { color: on ? c.onPrimary : c.ink }]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.list}>
            {OCCASIONS.map((o) => renderRow(o.value, o.value, o.icon, occasions.includes(o.value), () => setOccasions((p) => toggle(p, o.value))))}
          </View>
        ) : null}
        </Appear>

        <View style={styles.footer}>
          {errorMessage ? <Banner kind="error" title="No se guardaron tus preferencias" description={errorMessage} /> : null}
          <CoralButton
            title={step === 3 ? 'Ver mi inicio' : 'Continuar'}
            onPress={next}
            disabled={selected === 0}
            accessibilityHint={selected === 0 ? 'Elige al menos una opción o usa Omitir por ahora' : undefined}
            rightIcon={<ArrowRight size={18} color={c.onPrimary} strokeWidth={2.2} />}
            fullWidth
          />
          <CoralLink title="Omitir por ahora" color={c.ink2} onPress={skip} accessibilityHint="Podrás elegir tus preferencias después en tu perfil" />
        </View>
      </CoralScreen>
      <NoticeOutlet />
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: { gap: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  backSpacer: { width: 44, height: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 8 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  guide: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  bubble: { flex: 1 },
  heading: { gap: 8, paddingHorizontal: 8 },
  question: { fontFamily: coralFonts.title, fontSize: ms(27), lineHeight: 31, letterSpacing: -0.5 },
  list: { gap: 10 },
  option: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  optionLabel: { flex: 1, fontSize: 15.5 },
  box: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  footer: { marginTop: 'auto', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
});
