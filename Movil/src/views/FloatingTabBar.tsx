import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { typography, useTheme } from '@/shared/theme';
import { componentSizes } from '@/shared/theme/tokens/spacing';
import { radius } from '@/shared/theme/tokens/shapes';
import { CONTENT_MAX_WIDTH } from '@/shared/theme/tokens/responsive';
import { useKeyboardVisible } from '@/shared/lib/useKeyboardVisible';
import { tabTransition, type TabOrigin } from './tabTransition';

const BAR = componentSizes.tabBar;
const BUBBLE = 46;
const LIFT = 8;
const RING = 3;
const BAR_PADDING = 6;

type ItemProps = {
  label: string;
  focused: boolean;
  accessibilityLabel: string;
  renderIcon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
};

/** Burbuja que sale del botón activo, con rebote, y el anillo que se agranda y se desvanece. */
function ActiveBubble({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors, motion } = useTheme();
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const ring = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    // Sistema P1: subida corta y amortiguada, sin rebote, para no tapar el contenido.
    rise.value = withSpring(1, { damping: 18, stiffness: 180, mass: 0.7 });
    ring.value = withTiming(1, { duration: motion.durations.ripple, easing: Easing.out(Easing.quad) });
  }, [reduceMotion, rise, ring, motion.durations.ripple]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rise.value, [0, 0.3, 1], [0, 1, 1], 'clamp'),
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [16, 0]) },
      { scale: interpolate(rise.value, [0, 1], [0.6, 1]) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(ring.value, [0, 1], [0.4, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.9, 1.4]) }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.ripple, { borderColor: colors.tabBar.ripple }, ringStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bubbleRing,
          { borderColor: colors.surface.tabBar },
          bubbleStyle,
        ]}
      >
        <LinearGradient
          colors={colors.tabBar.bubble}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubble}
        />
      </Animated.View>
    </>
  );
}

function TabItem({ label, focused, accessibilityLabel, renderIcon, onPress, onLongPress }: ItemProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = reduceMotion
      ? focused ? 1 : 0
      : withSpring(focused ? 1 : 0, { damping: 18, stiffness: 170, mass: 0.8 });
  }, [focused, reduceMotion, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -LIFT * lift.value },
      { scale: interpolate(lift.value, [0, 1], [1, 1.05]) },
    ],
  }));

  // Sistema P1: iconos y etiquetas en tinta (el color del botón principal).
  const iconColor = focused ? colors.tabBar.bubbleIcon : colors.text.primary;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      {focused ? <ActiveBubble reduceMotion={reduceMotion} /> : null}
      <Animated.View style={[styles.icon, iconStyle]}>{renderIcon(iconColor)}</Animated.View>
      <Text
        numberOfLines={1}
        style={[
          focused ? typography.navLabelActive : typography.navLabel,
          { color: colors.text.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Barra de pestañas flotante del rediseño (design.md, sección 23): burbuja con rebote y anillo,
 * onda de expansión desde el botón, y publicación de la posición de cada botón para que la
 * pantalla nueva se abra como un círculo desde él (`TabScene`).
 */
export default function FloatingTabBar({ state, descriptors, insets, ...rest }: any) {
  const { emitter, navigateToTab } = rest;
  const { colors, glass, shadows } = useTheme();
  const keyboardVisible = useKeyboardVisible();
  const [outer, setOuter] = useState<{ y: number } | null>(null);
  const [inner, setInner] = useState<{ x: number; y: number; width: number } | null>(null);

  const visibleRoutes = state.routes.filter((route: any) => !(descriptors[route.key].options as { hidden?: boolean }).hidden);

  // Centro de la burbuja de cada destino, en coordenadas del contenedor de las pestañas.
  const centerOf = useCallback(
    (visibleIndex: number): TabOrigin | null => {
      if (!outer || !inner || visibleRoutes.length === 0) return null;
      const itemWidth = (inner.width - BAR_PADDING * 2) / visibleRoutes.length;
      return {
        x: inner.x + BAR_PADDING + itemWidth * (visibleIndex + 0.5),
        y: outer.y + inner.y + 18,
      };
    },
    [outer, inner, visibleRoutes.length]
  );

  const routeKeys = visibleRoutes.map((route: any) => route.name).join('|');
  useEffect(() => {
    const centers: Record<string, TabOrigin> = {};
    visibleRoutes.forEach((route: any, index: number) => {
      const center = centerOf(index);
      if (center) centers[route.name] = center;
    });
    tabTransition.setCenters(centers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOf, routeKeys]);

  const onOuterLayout = (event: LayoutChangeEvent) => setOuter({ y: event.nativeEvent.layout.y });
  const onInnerLayout = (event: LayoutChangeEvent) => {
    const { x, y, width } = event.nativeEvent.layout;
    setInner({ x, y, width });
  };

  if (keyboardVisible) return null;

  const canBlur = Platform.OS !== 'android';

  return (
    <View
      pointerEvents="box-none"
      onLayout={onOuterLayout}
      style={[styles.outer, { bottom: componentSizes.tabBarMarginBottom + insets.bottom }]}
    >
      <View onLayout={onInnerLayout} style={[styles.wrapper, shadows.card]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.surface,
            { backgroundColor: colors.surface.tabBar, borderColor: colors.border.glass },
          ]}
        >
          {canBlur ? (
            <BlurView intensity={glass.blurIntensityBar} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          ) : null}
        </View>
        <View accessibilityRole="tablist" style={styles.row}>
          {visibleRoutes.map((route: any) => {
            const { options } = descriptors[route.key];
            const focused = state.routes[state.index]?.key === route.key;
            const label = options.title ?? route.name;
            return (
              <TabItem
                key={route.key}
                label={label}
                focused={focused}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                renderIcon={(color) =>
                  options.tabBarIcon?.({ focused, color, size: componentSizes.icon }) ?? null
                }
                onPress={() => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (focused || event.defaultPrevented) return;
                  navigateToTab(route.key);
                }}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: componentSizes.tabBarMarginSide,
  },
  wrapper: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    height: BAR,
    borderRadius: radius.tabBar,
  },
  surface: {
    borderRadius: radius.tabBar,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: BAR_PADDING,
  },
  item: {
    flex: 1,
    height: BAR,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  icon: {
    zIndex: 3,
  },
  bubbleRing: {
    position: 'absolute',
    top: -8,
    width: BUBBLE + RING * 2,
    height: BUBBLE + RING * 2,
    borderRadius: 999,
    borderWidth: RING,
    zIndex: 2,
  },
  bubble: {
    flex: 1,
    borderRadius: 999,
  },
  ripple: {
    position: 'absolute',
    top: -5,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: 999,
    borderWidth: 2,
    zIndex: 1,
  },
});
