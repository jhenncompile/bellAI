/**
 * Avisos del sistema P1 (Penpot «Sistema P1», sección 06). Reemplazan a `Alert.alert`:
 * - `useNotice().notify(...)`: aviso breve abajo para confirmar algo que ya pasó (4 s).
 * - `<Banner />`: problema de la pantalla con la acción para resolverlo.
 * Para decisiones antes de seguir (borrar, cerrar sesión) se usa `Dialog`.
 * Dentro de un `Modal`, monta `<NoticeOutlet />` para que los avisos se vean encima.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff, X } from 'lucide-react-native';
import { componentSizes } from '../theme/tokens/spacing';
import { fonts } from '../theme/tokens/typography';
import { useTheme } from '../theme/ThemeContext';
import { ButtonOutline } from './button';

export type NoticeKind = 'success' | 'error' | 'info' | 'offline';

export interface NoticeOptions {
  message: string;
  kind?: NoticeKind;
  actionLabel?: string;
  onAction?: () => void;
  /** Duración en milisegundos (predeterminado 4000). */
  duration?: number;
}

type NoticeState = (NoticeOptions & { id: number }) | null;

interface NoticeContextValue {
  notify: (options: NoticeOptions) => void;
  close: () => void;
  notice: NoticeState;
  /** Pila de salidas montadas: el aviso se dibuja solo en la última (la ventana de arriba). */
  register: (id: number) => () => void;
  topOutlet: number;
}

const NoticeContext = createContext<NoticeContextValue>({
  notify: () => {},
  close: () => {},
  notice: null,
  register: () => () => {},
  topOutlet: 0,
});

export const useNotice = () => {
  const { notify } = useContext(NoticeContext);
  return { notify };
};

const ICON = { success: CircleCheck, error: CircleAlert, info: Info, offline: WifiOff } as const;
const ICON_COLOR = { success: '#9BD3A8', error: '#FFB3A6', info: '#FFD5A1', offline: '#FFB3A6' } as const;

let outletSeq = 1;

/**
 * Salida de avisos. La app tiene una en la raíz (sobre la barra de pestañas). Cada ventana a
 * pantalla completa (`Modal`) monta la suya dentro, porque un `Modal` tapa todo lo de la raíz:
 * así el aviso se ve encima de la ventana abierta.
 */
export function NoticeOutlet({ withTabBar = false, root = false }: { withTabBar?: boolean; root?: boolean }) {
  const insets = useSafeAreaInsets();
  const { notice, close, register, topOutlet } = useContext(NoticeContext);
  // La salida raíz tiene id 0 y no entra en la pila: siempre queda debajo de las ventanas.
  const [id] = useState(() => (root ? 0 : outletSeq++));
  useEffect(() => (root ? undefined : register(id)), [id, register, root]);
  if (!notice || topOutlet !== id) return null;
  const kind = notice.kind ?? 'info';
  const Icon = ICON[kind];
  return (
    <Animated.View
      key={notice.id}
      entering={FadeInDown.duration(250).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(200).reduceMotion(ReduceMotion.System)}
      pointerEvents="box-none"
      style={[styles.layer, { bottom: insets.bottom + (withTabBar ? componentSizes.tabBarClearance - 8 : 16) }]}
    >
      <View accessibilityRole="alert" style={styles.toast}>
        <Icon size={22} color={ICON_COLOR[kind]} strokeWidth={2.3} />
        <Text style={styles.message}>{notice.message}</Text>
        {notice.actionLabel && notice.onAction ? (
          <Pressable accessibilityRole="button" onPress={() => { notice.onAction?.(); close(); }} hitSlop={8} style={styles.action}>
            <Text style={styles.actionText}>{notice.actionLabel}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={close} hitSlop={8} style={styles.action}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<NoticeState>(null);
  const [outlets, setOutlets] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }, []);

  const notify = useCallback((options: NoticeOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ ...options, id: Date.now() });
    AccessibilityInfo.announceForAccessibility(options.message);
    timer.current = setTimeout(() => setNotice(null), options.duration ?? 4000);
  }, []);

  const register = useCallback((id: number) => {
    setOutlets((list) => [...list, id]);
    return () => setOutlets((list) => list.filter((x) => x !== id));
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(
    () => ({ notify, close, notice, register, topOutlet: outlets[outlets.length - 1] ?? 0 }),
    [notify, close, notice, register, outlets],
  );

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <NoticeOutlet withTabBar root />
    </NoticeContext.Provider>
  );
}

export type BannerKind = 'error' | 'warning' | 'info';

/** Banner dentro de la pantalla: qué pasó, qué significa y la acción para resolverlo. */
export function Banner({ kind = 'error', title, description, actionLabel, onAction }: {
  kind?: BannerKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const tone = {
    error: { color: colors.state.danger, bg: colors.state.dangerBg, Icon: CircleAlert },
    warning: { color: '#8A5300', bg: '#FFF1D6', Icon: TriangleAlert },
    info: { color: colors.text.primary, bg: colors.surface.card, Icon: Info },
  }[kind];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.color }]}>
      <tone.Icon size={22} color={tone.color} strokeWidth={2.3} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, { color: colors.text.primary }]}>{title}</Text>
        {description ? <Text style={[styles.bannerText, { color: colors.text.secondary }]}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? <ButtonOutline title={actionLabel} size="sm" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 488,
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2A1714',
    boxShadow: '0px 10px 24px rgba(42, 23, 20, 0.25)',
  },
  message: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: '#FFFFFF' },
  action: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.extrabold, fontSize: 14.5, color: '#FFB3A6', textDecorationLine: 'underline' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 20 },
  bannerText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
});
