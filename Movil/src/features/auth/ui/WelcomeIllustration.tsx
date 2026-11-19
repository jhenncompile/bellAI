import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Sparkles } from 'lucide-react-native';
import { Arch } from '@/shared/ui';
import { typography, useTheme } from '@/shared/theme';

/** Anchura de diseño de la composición en el lienzo (390 menos márgenes de 24, redondeada). */
const DESIGN_WIDTH = 350;
const DESIGN_HEIGHT = 330;
const STAR = 'M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z';

/** Movimiento vertical lento de un elemento decorativo. Se detiene con movimiento reducido. */
function Float({ children, offset = 0, style }: { children: React.ReactNode; offset?: number; style?: object }) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withDelay(
      offset,
      withRepeat(
        withSequence(withTiming(-9, { duration: 3500 }), withTiming(0, { duration: 3500 })),
        -1
      )
    );
  }, [reduceMotion, offset, lift]);

  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={[style, floating]}>{children}</Animated.View>;
}

function Pill({ label, dot, style, delay }: { label: string; dot: React.ReactNode; style: object; delay: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(600).reduceMotion(ReduceMotion.System)}
      style={[styles.pillWrap, style]}
    >
      <View style={[styles.pill, { backgroundColor: colors.surface.card, borderColor: colors.border.glass }]}>
        {dot}
        <Text style={[typography.smallStrong, { color: colors.text.primary }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Ilustración decorativa de la bienvenida: tres arcos con degradados fijos y tres píldoras.
 * No representa un diagnóstico personal y se excluye de la lectura accesible.
 */
export function WelcomeIllustration({
  availableWidth,
  availableHeight,
}: {
  /** Ancho libre medido del contenedor. */
  availableWidth: number;
  /** Alto libre medido del contenedor. */
  availableHeight: number;
}) {
  const { colors } = useTheme();
  // Se ajusta al espacio realmente disponible (ancho y alto), sin pasar de 1 ni bajar de 0,3.
  const scale = Math.max(0.3, Math.min(1, availableWidth / DESIGN_WIDTH, availableHeight / DESIGN_HEIGHT));
  const px = (value: number) => Math.round(value * scale);
  const palette = colors.palette;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: px(DESIGN_WIDTH), height: px(DESIGN_HEIGHT), alignSelf: 'center' }}
    >
      <Animated.View entering={FadeInDown.delay(150).duration(800).reduceMotion(ReduceMotion.System)} style={[styles.archSlot, { left: 0 }]}>
        <Float offset={0}>
          <Arch width={px(124)} height={px(220)} gradient={['#F6D3E0', '#E8899F']} bottomRadius={28}>
            <View style={[styles.sun, { top: px(34), width: px(44), height: px(44), borderRadius: px(22) }]} />
            <View style={[styles.dots, { bottom: px(22) }]}>
              {[palette.copper, palette.ochre, palette.olive].map((color) => (
                <View key={color} style={[styles.dot, { backgroundColor: color }]} />
              ))}
            </View>
          </Arch>
        </Float>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(800).reduceMotion(ReduceMotion.System)} style={[styles.archSlot, { left: px(104) }]}>
        <Float offset={600}>
          <Arch width={px(144)} height={px(306)} gradient={['#D9A441', '#C97B4A']} bottomRadius={28}>
            <View
              style={[
                styles.mark,
                { top: px(52), width: px(70), height: px(70), borderRadius: px(35), backgroundColor: '#241F26' },
              ]}
            >
              <Sparkles size={px(32)} color="#FFFFFF" />
            </View>
            <View
              style={[
                styles.torso,
                { left: px(18), right: px(18), bottom: px(26), height: px(70), borderTopLeftRadius: px(40), borderTopRightRadius: px(40) },
              ]}
            />
          </Arch>
        </Float>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(450).duration(800).reduceMotion(ReduceMotion.System)} style={[styles.archSlot, { left: px(232) }]}>
        <Float offset={1200}>
          <Arch width={px(118)} height={px(236)} gradient={['#E8899F', '#7A8450']} bottomRadius={28}>
            <View style={[styles.sunLow, { bottom: px(30), width: px(56), height: px(56), borderRadius: px(28) }]} />
            <View style={[styles.sunGold, { bottom: px(56), width: px(30), height: px(30), borderRadius: px(15), backgroundColor: palette.ochre }]} />
          </Arch>
        </Float>
      </Animated.View>

      <Svg width={20} height={20} viewBox="0 0 24 24" style={{ position: 'absolute', left: px(6), top: px(20) }}>
        <Path d={STAR} fill={colors.text.accent} opacity={0.9} />
      </Svg>
      <Svg width={14} height={14} viewBox="0 0 24 24" style={{ position: 'absolute', right: px(10), top: px(70) }}>
        <Path d={STAR} fill={colors.text.accent} opacity={0.7} />
      </Svg>

      <Pill
        label="Color personal"
        delay={900}
        style={{ left: px(2), top: px(84) }}
        dot={<View style={[styles.pillDot, { backgroundColor: colors.brand.accent }]} />}
      />
      <Pill
        label="Armario digital"
        delay={1100}
        style={{ right: 0, top: px(152) }}
        dot={<View style={[styles.pillDot, { backgroundColor: palette.olive }]} />}
      />
      <Pill
        label="Análisis corporal"
        delay={1300}
        style={{ left: px(20), bottom: px(6) }}
        dot={<View style={[styles.pillDot, { backgroundColor: palette.copper }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  archSlot: { position: 'absolute', bottom: 0 },
  sun: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.55)' },
  sunLow: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  sunGold: { position: 'absolute', alignSelf: 'center' },
  dots: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  mark: { position: 'absolute', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  torso: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  pillWrap: { position: 'absolute' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: { width: 18, height: 18, borderRadius: 9 },
});
