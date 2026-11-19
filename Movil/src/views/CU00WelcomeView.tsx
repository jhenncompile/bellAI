import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, MessageCircle, Palette, Shirt, Sparkles } from 'lucide-react-native';
import {
  Appear,
  CoralButton,
  CoralChip,
  CoralHero,
  CoralLink,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralShadow,
  coralText,
  useCoral,
} from '@/shared/ui/coral';

interface CU00WelcomeViewProps {
  onStart?: () => void;
  onLogin?: () => void;
}

/**
 * Bienvenida (propuesta P1): héroe coral con la mascota y las tres funciones principales,
 * titular, una sola acción principal y el acceso a la cuenta como enlace.
 */
export const CU00WelcomeView: React.FC<CU00WelcomeViewProps> = ({ onStart, onLogin }) => {
  const c = useCoral();
  const [heroHeight, setHeroHeight] = useState(0);

  const onHeroLayout = (event: LayoutChangeEvent) => {
    const h = Math.round(event.nativeEvent.layout.height);
    setHeroHeight((prev) => (prev === h ? prev : h));
  };

  const chipStyle = coralShadow(c, 6, 16, 0.08);

  return (
    <CoralScreen scrollable={false} contentStyle={styles.content}>
      <View style={styles.heroSlot} onLayout={onHeroLayout}>
        <CoralHero style={styles.hero} glow={{ left: '15%', top: 70, size: 250 }}>
          <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="BellAI">
            <View style={[styles.brandMark, { backgroundColor: '#FFFFFF' }]}>
              <Sparkles size={22} color={c.accent} strokeWidth={2} />
            </View>
            <Text style={[styles.brandName, { color: c.heroInk }]}>BellAI</Text>
          </View>

          {heroHeight > 0 ? (
            <Mascot pose="saludo" height={Math.min(180, Math.round(heroHeight * 0.42))} style={styles.mascot} enter="pop" />
          ) : null}

          <View accessible accessibilityLabel="Funciones: tu paleta, tu armario y tu asesora" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Appear delay={350} style={[styles.chip, { left: 18, top: '23%' }]}>
              <CoralChip label="Tu paleta" height={40} style={chipStyle} icon={<Palette size={16} color={c.accent} strokeWidth={2.2} />} />
            </Appear>
            <Appear delay={500} style={[styles.chip, { right: 18, top: '44%' }]}>
              <CoralChip label="Tu armario" height={40} style={chipStyle} icon={<Shirt size={16} color={c.accent} strokeWidth={2.2} />} />
            </Appear>
            <Appear delay={650} style={[styles.chip, { left: 18, top: '70%' }]}>
              <CoralChip label="Tu asesora" height={40} style={chipStyle} icon={<MessageCircle size={16} color={c.accent} strokeWidth={2.2} />} />
            </Appear>
          </View>
        </CoralHero>
      </View>

      <Appear delay={150} style={styles.copy}>
        <CoralTitle prefix="Tu estilo, " accent="a tu manera" size={38} />
        <Text style={[coralText.body, { color: c.ink2 }]}>
          Descubre tus colores, organiza tu armario y recibe consejos de tu asesora BellAI.
        </Text>
      </Appear>

      <Appear delay={250} style={styles.actions}>
        <CoralButton
          title="Comenzar"
          onPress={onStart}
          fullWidth
          accessibilityLabel="Comenzar y crear una cuenta en BellAI"
          accessibilityHint="Abre el formulario de registro"
          rightIcon={<ArrowRight size={18} color={c.onPrimary} strokeWidth={2.2} />}
        />
        <CoralLink
          title="Ya tengo una cuenta"
          underline
          onPress={onLogin}
          accessibilityLabel="Ya tengo una cuenta, iniciar sesión en BellAI"
          accessibilityHint="Abre el inicio de sesión"
        />
      </Appear>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 20 },
  // El héroe absorbe el alto libre: crece hasta 452 y se encoge en pantallas bajas.
  heroSlot: { flex: 1, minHeight: 280, maxHeight: 500 },
  hero: { flex: 1, borderRadius: 36 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'absolute', left: 20, top: 20 },
  brandMark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: coralFonts.title, fontSize: 22, lineHeight: 28, letterSpacing: -0.44 },
  mascot: { position: 'absolute', bottom: 8, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  chip: { position: 'absolute' },
  copy: { gap: 12, paddingHorizontal: 8 },
  actions: { gap: 6, paddingHorizontal: 8 },
});
