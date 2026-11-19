import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Bell, ChevronRight, Crown, Flag, History, Layers, LifeBuoy, LogOut, Moon, ScanFace, ShieldCheck, Shirt, Sparkles, UserRound } from 'lucide-react-native';
import { Dialog, Switch } from '@/shared/ui';
import {
  Appear,
  CoralButton,
  CoralCard,
  CoralChip,
  CoralIconBox,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { DARK_MODE_ENABLED, useTheme } from '@/shared/theme';
import { ms } from '@/shared/theme/tokens/responsive';

/** Tinta fija sobre los iconos pastel. */
const TILE_INK = '#2A1714';

interface CU04LogoutViewProps {
  user?: { name: string; email?: string; avatarUri?: string } | null;
  stats?: { garmentCount?: number | null; looksCount?: number; streakDays?: number };
  seasonLabel?: string; profileLoading?: boolean;
  onEditProfile?: () => void; onViewDiagnostic?: () => void; onGoToPrivacy?: () => void; onLogoutConfirm?: () => void;
  onViewHistory?: () => void; onViewStyle?: () => void; onReportProblem?: () => void;
  /** HU-28: reto semanal de estilo */
  onViewChallenge?: () => void;
  /** HU-22: combinaciones guardadas */
  onViewSavedOutfits?: () => void;
  /** HU-12 / HU-20: outfit del día y aviso de análisis terminado */
  notifications?: { enabled: boolean; busy?: boolean; onChange: (next: boolean) => void };
  /** Plan Gratis / Premium: resumen y acceso a la pantalla Premium. */
  plan?: { isPremium: boolean; subtitle: string } | null; onViewPlan?: () => void;
}

/** Fila de las secciones del perfil: icono pastel, título, qué hace y flecha (o el elemento final). */
function ProfileRow({ title, subtitle, Icon, gradient, onPress, trailing, busy, last }: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  gradient: readonly [string, string];
  onPress?: () => void;
  trailing?: React.ReactNode;
  busy?: boolean;
  last?: boolean;
}) {
  const c = useCoral();
  const body = (
    <>
      <CoralIconBox gradient={gradient}>
        <Icon size={20} color={TILE_INK} strokeWidth={2.2} />
      </CoralIconBox>
      <View style={styles.rowCopy}>
        <Text style={[coralText.strong, { color: c.ink }]}>{title}</Text>
        <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>{subtitle}</Text>
      </View>
      {busy ? <ActivityIndicator color={c.ink} accessibilityLabel="Cargando" />
        : trailing ?? (onPress ? <ChevronRight size={20} color={c.ink2} /> : null)}
    </>
  );
  const rowStyle = [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ busy: Boolean(busy), disabled: Boolean(busy) }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

/** Perfil (sistema P1): identidad, accesos de la cuenta, privacidad y cierre de sesión con confirmación. */
export const CU04LogoutView: React.FC<CU04LogoutViewProps> = ({
  user, stats, seasonLabel, profileLoading, onEditProfile, onViewDiagnostic, onGoToPrivacy, onLogoutConfirm,
  onViewHistory, onViewStyle, onReportProblem, onViewChallenge, onViewSavedOutfits, notifications, plan, onViewPlan,
}) => {
  const c = useCoral();
  const { isDark, setMode } = useTheme();
  const [confirm, setConfirm] = useState(false);
  const name = user?.name?.trim() || 'Mi perfil';
  // Los avatares por defecto (SVG de DiceBear) no se pueden mostrar con <Image>: se usa la inicial
  const avatarUri = user?.avatarUri && !/dicebear\.com|\/svg(\?|$)|\.svg(\?|$)/i.test(user.avatarUri) ? user.avatarUri : null;
  const garmentCount = stats?.garmentCount;

  return (
    <CoralScreen withTabBar>
      <View style={styles.content}>
        <View style={styles.header}>
          <CoralTitle prefix="Mi " accent="perfil" size={30} />
          <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>Tu cuenta, tus preferencias y tus datos.</Text>
        </View>

        <Appear>
          <CoralCard radius={24} style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: c.primary }]}>
              {avatarUri ? <Image source={{ uri: avatarUri }} accessibilityLabel={`Foto de ${name}`} style={styles.avatarImage} />
                : <Text style={[styles.initial, { color: c.onPrimary }]}>{name.charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={styles.identityCopy}>
              <Text style={[coralText.section, { color: c.ink }]} numberOfLines={2}>{name}</Text>
              {user?.email ? <Text style={[coralText.small, { color: c.ink2 }]} numberOfLines={1}>{user.email}</Text> : null}
              {typeof garmentCount === 'number' ? (
                <CoralChip
                  label={`${garmentCount} ${garmentCount === 1 ? 'prenda guardada' : 'prendas guardadas'}`}
                  height={28}
                  icon={<Shirt size={14} color={c.accent} strokeWidth={2.2} />}
                  style={styles.count}
                />
              ) : null}
            </View>
          </CoralCard>
        </Appear>

        {onViewPlan ? (
          <Appear delay={60} style={styles.section}>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Mi plan</Text>
            <CoralCard radius={24} padding={0} style={styles.list}>
              <ProfileRow
                title={plan?.isPremium ? 'Premium' : 'Gratis'}
                subtitle={plan?.subtitle ?? 'Consulta tu plan y lo que te queda de uso.'}
                Icon={Crown} gradient={c.tiles[2]} onPress={onViewPlan} last
                trailing={plan?.isPremium ? <CoralChip label="Activo" height={28} /> : undefined}
              />
            </CoralCard>
          </Appear>
        ) : null}

        {DARK_MODE_ENABLED || notifications ? (
          <Appear delay={80} style={styles.section}>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Preferencias</Text>
            <CoralCard radius={24} padding={0} style={styles.list}>
              {notifications ? (
                <ProfileRow
                  title="Notificaciones" subtitle="Tu outfit del día y aviso cuando termine tu análisis." Icon={Bell} gradient={c.tiles[2]}
                  last={!DARK_MODE_ENABLED} busy={notifications.busy}
                  trailing={(
                    <Switch
                      value={notifications.enabled}
                      onValueChange={notifications.onChange}
                      disabled={notifications.busy}
                      accessibilityLabel="Notificaciones"
                    />
                  )}
                />
              ) : null}
              {DARK_MODE_ENABLED ? (
                <ProfileRow
                  title="Apariencia oscura" subtitle="Cambia entre claro y oscuro." Icon={Moon} gradient={c.tiles[3]} last
                  trailing={<Switch value={isDark} onValueChange={(next) => setMode(next ? 'dark' : 'light')} accessibilityLabel="Apariencia oscura" />}
                />
              ) : null}
            </CoralCard>
          </Appear>
        ) : null}

        <Appear delay={120} style={styles.section}>
          <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Tu espacio</Text>
          <CoralCard radius={24} padding={0} style={styles.list}>
            <ProfileRow
              title="Datos y preferencias" subtitle="Edita tu perfil y lo que te gusta." Icon={UserRound} gradient={c.tiles[0]}
              busy={profileLoading} onPress={() => onEditProfile?.()}
              last={!onViewDiagnostic && !onViewStyle && !onViewSavedOutfits && !onViewChallenge && !onViewHistory}
            />
            {onViewDiagnostic ? (
              <ProfileRow
                title="Mi análisis" subtitle={seasonLabel || 'Consulta tu paleta y recomendaciones.'} Icon={ScanFace} gradient={c.tiles[1]}
                onPress={onViewDiagnostic} last={!onViewStyle && !onViewSavedOutfits && !onViewChallenge && !onViewHistory}
              />
            ) : null}
            {onViewStyle ? (
              <ProfileRow
                title="Mi estilo" subtitle="Style DNA y recomendaciones que aprenden de ti." Icon={Sparkles} gradient={c.tiles[2]}
                onPress={onViewStyle} last={!onViewSavedOutfits && !onViewChallenge && !onViewHistory}
              />
            ) : null}
            {onViewSavedOutfits ? (
              <ProfileRow
                title="Mis combinaciones" subtitle="Las que guardaste, favoritas y valoradas." Icon={Layers} gradient={c.tiles[3]}
                onPress={onViewSavedOutfits} last={!onViewChallenge && !onViewHistory}
              />
            ) : null}
            {onViewChallenge ? (
              <ProfileRow
                title="Reto de la semana" subtitle="Tareas para mejorar tu imagen cada semana." Icon={Flag} gradient={c.tiles[0]}
                onPress={onViewChallenge} last={!onViewHistory}
              />
            ) : null}
            {onViewHistory ? (
              <ProfileRow
                title="Mi historial" subtitle="Análisis, outfits, simulaciones y valoraciones." Icon={History} gradient={c.tiles[3]}
                onPress={onViewHistory} last
              />
            ) : null}
          </CoralCard>
        </Appear>

        <Appear delay={200} style={styles.section}>
          <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Privacidad</Text>
          <CoralCard radius={24} padding={0} style={styles.list}>
            <ProfileRow
              title="Privacidad y datos" subtitle="Permisos de fotos, descarga o borrado de tus datos." Icon={ShieldCheck} gradient={c.tiles[1]}
              onPress={() => onGoToPrivacy?.()} last={!onReportProblem}
            />
            {onReportProblem ? (
              <ProfileRow
                title="Reportar un problema" subtitle="Cuéntanos qué falla o sugiérenos algo." Icon={LifeBuoy} gradient={c.tiles[0]}
                onPress={onReportProblem} last
              />
            ) : null}
          </CoralCard>
        </Appear>

        <Appear delay={280} style={styles.footer}>
          <CoralButton
            title="Cerrar sesión"
            variant="secondary"
            leftIcon={<LogOut size={18} color={c.ink} strokeWidth={2.2} />}
            onPress={() => setConfirm(true)}
            accessibilityHint="Te pediremos confirmación"
            fullWidth
          />
          <Text style={[coralText.caption, styles.center, { color: c.ink2 }]}>BellAI · El estilo lo defines tú.</Text>
        </Appear>
      </View>

      <Dialog
        visible={confirm}
        onClose={() => setConfirm(false)}
        titlePrefix="¿Cerrar "
        titleAccent="sesión"
        titleSuffix="?"
        description="Tu armario y tus análisis te esperan cuando vuelvas a iniciar sesión."
        actions={<>
          <CoralButton title="Cerrar sesión" onPress={() => { setConfirm(false); onLogoutConfirm?.(); }} fullWidth />
          <CoralButton title="Seguir en mi cuenta" variant="secondary" onPress={() => setConfirm(false)} fullWidth />
        </>}
      />
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 18, paddingTop: 4 },
  header: { gap: 4, paddingHorizontal: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, gap: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initial: { fontFamily: coralFonts.title, fontSize: ms(28), lineHeight: 34 },
  count: { marginTop: 6 },
  section: { gap: 12 },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10 },
  rowCopy: { flex: 1, gap: 2 },
  footer: { gap: 8, marginTop: 4 },
  center: { textAlign: 'center' },
});
