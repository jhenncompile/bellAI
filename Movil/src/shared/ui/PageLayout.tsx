import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { Button } from './button';
import { Mascot, type MascotPose } from './coral';
import { AccentTitle } from './AccentTitle';

export function PageHeader({ title, titleAccent, description, action, onBack, compact = false }: {
  title: string;
  /** Palabra final del título en cursiva y color de acento («Mi» + «armario»). */
  titleAccent?: string;
  description?: string;
  action?: React.ReactNode;
  /** Muestra el botón circular de retorno de 44. */
  onBack?: () => void;
  /** Título de 26 junto al botón de retorno, en lugar del de 32. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const variant = compact ? 'titleBar' : 'h1';
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={onBack}
          style={[styles.back, { backgroundColor: colors.surface.card, borderColor: colors.border.glass }]}
        >
          <ChevronLeft size={22} color={colors.text.primary} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        {titleAccent ? (
          <AccentTitle variant={variant} prefix={`${title} `} accent={titleAccent} />
        ) : (
          <Text accessibilityRole="header" style={[typography[variant], { color: colors.text.primary }]}>{title}</Text>
        )}
        {description ? <Text style={[typography.body, { color: colors.text.secondary }]}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** Tipo de estado de la sección 07 del sistema P1. Decide qué mascota acompaña. */
export type ContentStateKind = 'loading' | 'thinking' | 'empty' | 'error';

const STATE_MASCOT: Partial<Record<ContentStateKind, MascotPose>> = { thinking: 'pensando', empty: 'vacio', error: 'error' };

/**
 * Estados de pantalla (sistema P1, sección 07). Sin `kind`, se deduce: cargando si `loading`,
 * error si el título habla de un fallo («No pudimos…») y vacío si hay una acción.
 */
export function ContentState({ title, description, loading, actionLabel, onAction, icon, kind }: {
  title: string; description?: string; loading?: boolean; actionLabel?: string;
  onAction?: () => void; icon?: React.ReactNode; kind?: ContentStateKind;
}) {
  const { colors } = useTheme();
  const resolved: ContentStateKind = kind
    ?? (loading ? 'loading' : /^(no pudimos|no se pudo|error|algo salió mal)/i.test(title) ? 'error' : actionLabel ? 'empty' : 'loading');
  const pose = icon ? undefined : STATE_MASCOT[resolved];
  return (
    <View style={[styles.state, { backgroundColor: colors.surface.card }]}>
      {resolved === 'loading' && loading ? <ActivityIndicator color={colors.text.primary} accessibilityLabel="Cargando" /> : null}
      {pose ? <Mascot pose={pose} height={140} enter="pop" float={resolved === 'thinking'} /> : icon}
      <Text accessibilityRole="header" style={[typography.h3, styles.center, { color: colors.text.primary }]}>{title}</Text>
      {description ? <Text accessibilityLiveRegion="polite" style={[typography.body, styles.center, { color: colors.text.secondary }]}>{description}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant={resolved === 'error' ? 'primary' : 'outline'} /> : null}
    </View>
  );
}

export function NavigationRow({ title, description, icon, onPress, loading = false }: {
  title: string; description?: string; icon: React.ReactNode; onPress: () => void; loading?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description}
      accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
      onPress={onPress} activeOpacity={0.65}
      style={[styles.row, { borderColor: colors.border.subtle }]}
    >
      <View accessible={false} style={[styles.icon, { backgroundColor: colors.background.tertiary }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[typography.bodyStrong, { color: colors.text.primary }]}>{title}</Text>
        {description ? <Text style={[typography.small, { color: colors.text.secondary }]}>{description}</Text> : null}
      </View>
      {loading ? <ActivityIndicator color={colors.text.primary} /> : <ChevronRight size={18} color={colors.text.secondary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Si las acciones no caben junto al título, bajan a una segunda línea en vez de aplastarlo.
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 180, gap: spacing.xs },
  action: { flexShrink: 1, maxWidth: '100%' },
  state: { alignItems: 'center', gap: spacing.md, padding: spacing.xxl, borderRadius: radius.xxl, boxShadow: '0px 10px 28px rgba(179, 57, 46, 0.14)' },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 76, paddingVertical: spacing.md, borderBottomWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
