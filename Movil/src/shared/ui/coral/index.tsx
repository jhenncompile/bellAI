/**
 * Piezas de la propuesta P1 «Coral amanecer». Se usan en Acceso, la bienvenida guiada e Inicio.
 * Colores en `shared/theme/tokens/coral.ts`; iconos de Lucide, igual que el resto de la app.
 */
import React, { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeInUp,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  DimensionValue,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { componentSizes } from '../../theme/tokens/spacing';
import { ms } from '../../theme/tokens/responsive';
import { coralDark, coralFonts, coralHeroDirection, coralLight, type CoralTokens } from '../../theme/tokens/coral';
import { ButtonBase, type ButtonBaseProps } from '../button/ButtonBase';

export { coralFonts };
export type { CoralTokens };

/** Colores de la propuesta según el modo activo. */
export function useCoral(): CoralTokens {
  const { isDark } = useTheme();
  return isDark ? coralDark : coralLight;
}

/** Sombra suave teñida, en el formato `boxShadow` que entienden iOS, Android y web. */
export function coralShadow(c: CoralTokens, y = 10, blur = 28, alpha = 0.14): ViewStyle {
  const hex = c.shadow.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { boxShadow: `0px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${alpha})` };
}

// ---------------------------------------------------------------- Pantalla

interface CoralScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  /** Deja espacio inferior para la barra de pestañas flotante. */
  withTabBar?: boolean;
  /** Sube el contenido cuando aparece el teclado (formularios). */
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Fondo crema en gradiente vertical, márgenes seguros y ancho máximo de lectura. */
export function CoralScreen({ children, scrollable = true, withTabBar = false, keyboard = false, contentStyle }: CoralScreenProps) {
  const c = useCoral();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, StatusBar.currentHeight || 0) + 8;
  const bottom = insets.bottom + (withTabBar ? componentSizes.tabBarClearance : 16);

  const body = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scroll, { paddingTop: top, paddingBottom: bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.scroll, { paddingTop: top, paddingBottom: bottom }, contentStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={c.background} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.flex}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </LinearGradient>
  );
}

// ---------------------------------------------------------------- Texto

interface CoralTitleProps {
  prefix?: string;
  accent?: string;
  suffix?: string;
  size?: number;
  color?: string;
  accentColor?: string;
  align?: 'left' | 'center';
  style?: StyleProp<TextStyle>;
}

/** Título en Fraunces con una palabra clave en cursiva y color de acento. */
export function CoralTitle({ prefix = '', accent, suffix = '', size: designSize = 34, color, accentColor, align = 'left', style }: CoralTitleProps) {
  const c = useCoral();
  // Se reduce hasta el 82 % en teléfonos angostos para que el título no se parta de más.
  const size = ms(designSize);
  return (
    <Text
      accessibilityRole="header"
      style={[{
        fontFamily: coralFonts.title,
        fontSize: size,
        lineHeight: Math.round(size * 1.12),
        letterSpacing: -0.02 * size,
        color: color ?? c.ink,
        textAlign: align,
      }, style]}
    >
      {prefix}
      {accent ? <Text style={{ fontFamily: coralFonts.titleAccent, color: accentColor ?? c.accent }}>{accent}</Text> : null}
      {suffix}
    </Text>
  );
}

/** Estilos de texto de la propuesta (Nunito). */
export const coralText = StyleSheet.create({
  body: { fontFamily: coralFonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: coralFonts.semibold, fontSize: 13.5, lineHeight: 18 },
  caption: { fontFamily: coralFonts.semibold, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: coralFonts.bold, fontSize: 14, lineHeight: 19 },
  section: { fontFamily: coralFonts.extrabold, fontSize: 18, lineHeight: 24 },
  strong: { fontFamily: coralFonts.extrabold, fontSize: 15, lineHeight: 20 },
});

// ---------------------------------------------------------------- Botones

export type CoralButtonVariant = 'primary' | 'secondary' | 'light';

export interface CoralButtonProps extends Omit<ButtonBaseProps, 'size'> {
  variant?: CoralButtonVariant;
  /** Alto del botón: 54 (predeterminado), 44 o 36. */
  height?: 54 | 44 | 36;
}

/** Botón en píldora. El principal es tinta sólida; el secundario lleva contorno. */
export function CoralButton({ variant = 'primary', height = 54, style, textStyle, ...rest }: CoralButtonProps) {
  const c = useCoral();
  const ink = variant === 'primary' ? c.onPrimary : variant === 'light' ? c.accent : c.ink;
  const box: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: c.primary }
      : variant === 'light'
        ? { backgroundColor: '#FFFFFF' }
        : { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.ink };
  return (
    <ButtonBase
      {...rest}
      loadingColor={ink}
      style={[styles.button, { minHeight: Math.max(height, 44), borderRadius: height / 2 }, box, style]}
      contentStyle={styles.buttonContent}
      textStyle={[{ color: ink, fontFamily: coralFonts.bold, fontSize: height >= 54 ? 16 : height >= 44 ? 15 : 13.5 }, textStyle]}
    />
  );
}

/** Enlace de texto con área táctil de 44 px. */
export function CoralLink({ title, onPress, color, underline, disabled, accessibilityLabel, accessibilityHint, style }: {
  title: React.ReactNode;
  onPress?: () => void;
  color?: string;
  underline?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }, disabled && { opacity: 0.5 }, style]}
    >
      <Text style={[coralText.label, { fontSize: 15.5, color: color ?? c.ink, textDecorationLine: underline ? 'underline' : 'none' }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Botón redondo de 44 px para volver. */
export function CoralBackButton({ onPress, label = 'Volver', disabled }: { onPress?: () => void; label?: string; disabled?: boolean }) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { backgroundColor: c.card }, coralShadow(c, 4, 12), pressed && { opacity: 0.7 }]}
    >
      <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Superficies

export function CoralCard({ children, style, radius = 28, padding = 18 }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  padding?: number;
}) {
  const c = useCoral();
  return <View style={[{ backgroundColor: c.card, borderRadius: radius, padding }, coralShadow(c), style]}>{children}</View>;
}

/** Tarjeta destacada con el gradiente coral y un brillo blanco. */
export function CoralHero({ children, style, glow = { right: -40, top: 20, size: 220 }, accessibilityLabel }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: { left?: DimensionValue; right?: DimensionValue; top: DimensionValue; size: number };
  accessibilityLabel?: string;
}) {
  const c = useCoral();
  const radial = `radial-gradient(circle closest-side, ${c.heroGlow} 0%, rgba(255,255,255,0) 100%)`;
  const paint = Platform.OS === 'web' ? ({ backgroundImage: radial } as object) : { experimental_backgroundImage: radial };
  return (
    <LinearGradient
      colors={c.hero}
      start={coralHeroDirection.start}
      end={coralHeroDirection.end}
      style={[styles.hero, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        pointerEvents="none"
        accessible={false}
        style={[styles.glow, { width: glow.size, height: glow.size, top: glow.top, left: glow.left, right: glow.right }, paint]}
      />
      {children}
    </LinearGradient>
  );
}

/** Etiqueta en píldora (blanca sobre el héroe o el fondo). */
export function CoralChip({ label, icon, height = 36, style }: {
  label: string;
  icon?: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCoral();
  return (
    <View style={[styles.chip, { height, borderRadius: height / 2, backgroundColor: c.chip }, style]}>
      {icon}
      <Text style={[coralText.caption, { fontFamily: coralFonts.bold, fontSize: 13, color: '#2A1714' }]}>{label}</Text>
    </View>
  );
}

/** Caja de icono con gradiente pastel. */
export function CoralIconBox({ gradient, size = 40, radius = 14, children }: {
  gradient: readonly [string, string];
  size?: number;
  radius?: number;
  children: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </LinearGradient>
  );
}

/** Estilos para `InputText` y `PasswordInput` con la apariencia de la propuesta. */
export function useCoralFieldStyles() {
  const c = useCoral();
  return {
    placeholderTextColor: c.placeholder,
    labelStyle: { fontFamily: coralFonts.bold, fontSize: 14, color: c.ink } as TextStyle,
    // Sin color de borde: el campo conserva los colores de foco y error de `InputBase`.
    inputBoxStyle: { backgroundColor: c.field, borderWidth: 1.5, borderRadius: 18, minHeight: 54 } as ViewStyle,
    style: { fontFamily: coralFonts.semibold, fontSize: 16, color: c.ink } as TextStyle,
    iconColor: c.ink2,
  };
}

// ---------------------------------------------------------------- Mascota

const MASCOT = {
  saludo: { src: require('../../../../assets/images/mascota/saludo.png'), ratio: 500 / 660 },
  asoma: { src: require('../../../../assets/images/mascota/asoma.png'), ratio: 369 / 324 },
  camara: { src: require('../../../../assets/images/mascota/camara.png'), ratio: 358 / 398 },
  corazon: { src: require('../../../../assets/images/mascota/corazon.png'), ratio: 286 / 300 },
  ropa: { src: require('../../../../assets/images/mascota/ropa.png'), ratio: 327 / 360 },
  feliz: { src: require('../../../../assets/images/mascota/feliz.png'), ratio: 303 / 360 },
  pensando: { src: require('../../../../assets/images/mascota/pensando.png'), ratio: 275 / 391 },
  error: { src: require('../../../../assets/images/mascota/error.png'), ratio: 330 / 420 },
  vacio: { src: require('../../../../assets/images/mascota/vacio.png'), ratio: 326 / 420 },
  privacidad: { src: require('../../../../assets/images/mascota/privacidad.png'), ratio: 299 / 420 },
  celebrando: { src: require('../../../../assets/images/mascota/celebrando.png'), ratio: 355 / 420 },
  senalando: { src: require('../../../../assets/images/mascota/senalando.png'), ratio: 324 / 420 },
  paleta: { src: require('../../../../assets/images/mascota/paleta.png'), ratio: 372 / 420 },
  conversando: { src: require('../../../../assets/images/mascota/conversando.png'), ratio: 327 / 420 },
  fotografo: { src: require('../../../../assets/images/mascota/fotografo.png'), ratio: 332 / 420 },
} as const;

export type MascotPose = keyof typeof MASCOT;

// ---------------------------------------------------------------- Movimiento
// Todas las animaciones respetan «reducir movimiento» del sistema: con esa opción no se mueven.

/** Entrada suave (sube y aparece) con retraso, para escalonar bloques de una pantalla. */
export function Appear({ children, delay = 0, from = 'down', style }: {
  children: React.ReactNode;
  delay?: number;
  /** `down`: entra desde abajo; `up`: entra desde arriba. */
  from?: 'down' | 'up';
  style?: StyleProp<ViewStyle>;
}) {
  const anim = (from === 'down' ? FadeInDown : FadeInUp).delay(delay).duration(500).reduceMotion(ReduceMotion.System);
  return <Animated.View entering={anim} style={style}>{children}</Animated.View>;
}

/** Flotación vertical sutil y calmada para ilustraciones. */
function Float({ children, amplitude = 2.5 }: { children: React.ReactNode; amplitude?: number }) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(lift);
  }, [reduceMotion, amplitude, lift]);
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={floating}>{children}</Animated.View>;
}

/**
 * Mascota de BellAI. Es decorativa: no se anuncia en lectores de pantalla.
 * `enter`: `pop` o `rise` entrada suave sin rebotes invasivos. `float`: oscilación sutil.
 * Para repetir la entrada (por ejemplo al cambiar de pregunta), cambia su `key`.
 */
export function Mascot({ pose, height, style, enter, float, delay = 0 }: {
  pose: MascotPose;
  height: number;
  style?: StyleProp<ViewStyle>;
  enter?: 'pop' | 'rise';
  float?: boolean;
  delay?: number;
}) {
  const m = MASCOT[pose];
  const entering = enter === 'pop'
    ? FadeInDown.delay(delay).duration(280).reduceMotion(ReduceMotion.System)
    : enter === 'rise'
      ? FadeInDown.delay(delay).duration(300).reduceMotion(ReduceMotion.System)
      : undefined;
  const image = <Image source={m.src} style={{ width: Math.round(height * m.ratio), height }} resizeMode="contain" />;
  return (
    <Animated.View
      entering={entering}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {float ? <Float>{image}</Float> : image}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16 },
  button: { borderWidth: 0, paddingHorizontal: 20 },
  buttonContent: { gap: 8 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 30, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 9999 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, alignSelf: 'flex-start' },
});
