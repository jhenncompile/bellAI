import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { CircleAlert, Download, FolderArchive, Lock, ScanFace, Share2, Trash2 } from 'lucide-react-native';
import { Banner, ButtonDanger, Dialog, PasswordInput, Switch } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralIconBox,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { useTheme } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';
import { PrivacyDataSummary } from '@/features/privacy/api/privacyService';
import { VaultItem } from '@/entities/media-vault/model/types';

/** Tinta fija sobre los iconos pastel. */
const TILE_INK = '#2A1714';

export interface PrivacyActionError {
  title: string;
  description?: string;
  /** Si existe, el aviso muestra «Reintentar». */
  retry?: () => void;
}

interface CU11PrivacyDataViewProps {
  summary: PrivacyDataSummary | null;
  localPhotos: VaultItem[];
  loading: boolean;
  loadingError?: string;
  consentActive: boolean;
  updatingConsent?: boolean;
  downloading?: boolean;
  deleting?: boolean;
  onBack?: () => void;
  onRetry?: () => void;
  onToggleConsent?: () => void;
  /** HU-034: conservar fotos para el historial (por defecto se borran al terminar el análisis). */
  retentionActive?: boolean;
  updatingRetention?: boolean;
  onToggleRetention?: (next: boolean) => void;
  onDownloadData?: () => Promise<void>;
  onDownloadPhoto?: (photo: VaultItem) => Promise<void>;
  /** CP-029-03: la eliminación se confirma con la contraseña actual. */
  onDeleteDataConfirm?: (password: string) => Promise<void>;
  /** Problema de la última acción (guardar un permiso, descargar…). Se muestra como aviso arriba. */
  actionError?: PrivacyActionError | null;
  /** Motivo por el que no se eliminó la cuenta; se muestra dentro de la confirmación. */
  deleteError?: string;
}

const formatCount = (count: number | undefined): string => `${count ?? 0}`;
const formatOptionalValue = (value: string | undefined): string => value?.trim() || 'No guardado';
const formatList = (value: unknown): string =>
  Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Sin preferencias guardadas';

/** Permiso con interruptor: qué es, qué pasa si está activado y qué pasa si no. */
function PermissionRow({ title, on, onText, offText, Icon, gradient, busy, onChange, last }: {
  title: string;
  on: boolean;
  onText: string;
  offText: string;
  Icon: LucideIcon;
  gradient: readonly [string, string];
  busy?: boolean;
  onChange?: (next: boolean) => void;
  last?: boolean;
}) {
  const c = useCoral();
  return (
    <View style={[styles.permission, !last && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }]}>
      <CoralIconBox gradient={gradient}>
        <Icon size={20} color={TILE_INK} strokeWidth={2.2} />
      </CoralIconBox>
      <View style={styles.flex}>
        <Text style={[coralText.strong, { color: c.ink }]}>{title}</Text>
        <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: c.ink, marginTop: 2 }]}>
          {busy ? 'Guardando…' : on ? 'Activado' : 'Desactivado'}
        </Text>
        <Text style={[coralText.caption, { fontSize: 13, color: c.ink2, marginTop: 2 }]}>{on ? onText : offText}</Text>
      </View>
      {busy ? <ActivityIndicator color={c.ink} accessibilityLabel="Guardando" style={styles.switchSlot} /> : (
        <Switch value={on} disabled={!onChange} onValueChange={(next) => { hapticFeedback.light(); onChange?.(next); }} accessibilityLabel={title} />
      )}
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  const c = useCoral();
  return (
    <View style={styles.dataRow}>
      <Text style={[coralText.label, { color: c.ink }]}>{label}</Text>
      <Text style={[coralText.small, { color: c.ink2 }]}>{value}</Text>
    </View>
  );
}

/** Privacidad y datos (sistema P1): permisos explicados, lo que guardamos, descarga y borrado de la cuenta. */
export const CU11PrivacyDataView: React.FC<CU11PrivacyDataViewProps> = ({
  summary,
  localPhotos,
  loading,
  loadingError,
  consentActive,
  updatingConsent = false,
  downloading = false,
  deleting = false,
  onBack,
  onRetry,
  onToggleConsent,
  retentionActive = false,
  updatingRetention = false,
  onToggleRetention,
  onDownloadData,
  onDownloadPhoto,
  onDeleteDataConfirm,
  actionError,
  deleteError,
}) => {
  const c = useCoral();
  const { iconColor, ...field } = useCoralFieldStyles();
  const { colors } = useTheme();
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const closeDelete = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeletePassword('');
  };
  const stylePreferences = (summary?.preferences.stylePreferences || {}) as Record<string, unknown>;
  const budget = stylePreferences.budgetPerGarment;
  const language = summary?.preferences.language ? String(summary.preferences.language) : '';

  return (
    <CoralScreen contentStyle={styles.content}>
      <View style={styles.top}>
        {onBack ? <CoralBackButton label="Volver al perfil" onPress={() => { hapticFeedback.light(); onBack(); }} /> : null}
      </View>

      <View style={styles.header}>
        <Mascot pose="privacidad" height={104} enter="pop" style={styles.mascot} />
        <CoralTitle prefix="Privacidad y " accent="datos" size={30} align="center" />
        <Text style={[coralText.body, styles.center, { fontSize: 15, color: c.ink2 }]}>
          Tú decides qué hacemos con tus fotos y tus datos. Puedes cambiarlo cuando quieras.
        </Text>
      </View>

      {actionError ? (
        <Banner
          kind="error"
          title={actionError.title}
          description={actionError.description}
          actionLabel={actionError.retry ? 'Reintentar' : undefined}
          onAction={actionError.retry}
        />
      ) : null}

      <Appear style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Permisos</Text>
        <CoralCard radius={24} padding={0} style={styles.list}>
          <PermissionRow
            title="Analizar mis fotos"
            on={consentActive}
            onText="Usamos tus fotos de rostro y cuerpo solo para tu diagnóstico de color y estilo."
            offText="No procesamos ninguna foto. Sin este permiso no podemos hacer tu diagnóstico."
            Icon={ScanFace}
            gradient={c.tiles[0]}
            busy={updatingConsent}
            onChange={onToggleConsent ? () => onToggleConsent() : undefined}
            last={!onToggleRetention}
          />
          {onToggleRetention ? (
            <PermissionRow
              title="Conservar mis fotos"
              on={retentionActive}
              onText="Guardamos tus fotos de análisis y simulaciones de forma privada para tu historial."
              offText="Cada foto se borra en cuanto termina su análisis. No queda copia en tu cuenta."
              Icon={FolderArchive}
              gradient={c.tiles[1]}
              busy={updatingRetention}
              onChange={onToggleRetention}
              last
            />
          ) : null}
        </CoralCard>
      </Appear>

      <Appear delay={100} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Lo que guardamos</Text>
        {loading ? (
          <CoralCard radius={24} style={styles.loading}>
            <ActivityIndicator color={c.ink} accessibilityLabel="Cargando" />
            <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>Consultando la información de tu cuenta…</Text>
          </CoralCard>
        ) : loadingError ? (
          <Banner kind="error" title="No pudimos consultar tus datos" description={loadingError} actionLabel={onRetry ? 'Reintentar' : undefined} onAction={onRetry} />
        ) : summary ? (
          <CoralCard radius={24} style={styles.dataCard}>
            <DataRow label="Cuenta" value={`${summary.account.name} · ${summary.account.email}`} />
            <View style={[styles.divider, { backgroundColor: c.fieldStroke }]} />
            <DataRow label="Biografía" value={formatOptionalValue(summary.profile.bio)} />
            <DataRow label="Teléfono" value={formatOptionalValue(summary.profile.phone)} />
            <DataRow label="Dirección" value={formatOptionalValue(summary.profile.address)} />
            <DataRow label="Fecha de nacimiento" value={formatOptionalValue(summary.profile.birthDate)} />
            <DataRow label="Fotografía de perfil" value={summary.profile.avatarUrl ? 'Guardada' : 'No guardada'} />
            <View style={[styles.divider, { backgroundColor: c.fieldStroke }]} />
            <DataRow label="Estilos preferidos" value={formatList(stylePreferences.preferredStyles)} />
            <DataRow label="Estilos que quieres evitar" value={formatList(stylePreferences.dislikedStyles)} />
            <DataRow label="Objetivos" value={formatList(stylePreferences.goals)} />
            <DataRow label="Ocasiones habituales" value={formatList(stylePreferences.occasions)} />
            <DataRow label="Colores preferidos" value={formatList(stylePreferences.preferredColors)} />
            <DataRow label="Colores que quieres evitar" value={formatList(stylePreferences.avoidedColors)} />
            <DataRow label="Presupuesto por prenda" value={typeof budget === 'number' ? `Bs ${budget}` : 'Sin límite definido'} />
            {language ? <DataRow label="Idioma" value={language} /> : null}
            <View style={[styles.divider, { backgroundColor: c.fieldStroke }]} />
            <DataRow label="Prendas en el armario" value={formatCount(summary.wardrobe.itemCount)} />
            {summary.wardrobe.items.map((item, index) => (
              <DataRow key={`${item.name}-${index}`} label={item.name} value={item.category} />
            ))}
            <View style={[styles.divider, { backgroundColor: c.fieldStroke }]} />
            <DataRow label="Fotografías en tu cuenta" value={formatCount(summary.photos.totalCount)} />
            <DataRow label="Fotografías en este dispositivo" value={formatCount(localPhotos.length)} />
            <DataRow label="Registros de permisos" value={formatCount(summary.consents.recordCount)} />
            {summary.analysis ? (
              <DataRow
                label="Actividad"
                value={`${summary.analysis.diagnostics} análisis, ${summary.analysis.storedPhotos} fotos guardadas, ${summary.analysis.conversations} conversaciones y ${summary.analysis.outfits} outfits.`}
              />
            ) : null}
          </CoralCard>
        ) : null}
      </Appear>

      <Appear delay={160} style={styles.section}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Fotos de este dispositivo</Text>
        <CoralCard radius={24} padding={localPhotos.length ? 0 : 18} style={localPhotos.length ? styles.list : undefined}>
          {localPhotos.length === 0 ? (
            <Text style={[coralText.small, { color: c.ink2 }]}>No hay fotografías guardadas en este dispositivo.</Text>
          ) : (
            localPhotos.map((photo, i) => (
              <View key={photo.id} style={[styles.photoRow, i < localPhotos.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }]}>
                <View style={styles.flex}>
                  <Text style={[coralText.label, { color: c.ink }]}>{photo.summary}</Text>
                  <Text style={[coralText.caption, { color: c.ink2 }]}>{photo.folder} · {photo.dateLabel}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Guardar o compartir la fotografía ${photo.summary}`}
                  onPress={() => { void onDownloadPhoto?.(photo); }}
                  style={({ pressed }) => [styles.iconButton, { backgroundColor: c.muted }, pressed && { opacity: 0.7 }]}
                >
                  <Share2 size={20} color={c.ink} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))
          )}
        </CoralCard>
      </Appear>

      <View style={styles.actions}>
        <CoralButton
          title="Descargar mis datos"
          leftIcon={<Download size={18} color={c.onPrimary} strokeWidth={2.2} />}
          loading={downloading}
          disabled={downloading || loading || !summary}
          onPress={() => { hapticFeedback.light(); setConfirmDownload(true); }}
          accessibilityHint="Prepara un archivo con tus datos personales y enlaces a tus fotografías"
          fullWidth
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta y mis datos"
          accessibilityHint="Te pediremos tu contraseña para confirmar"
          disabled={deleting}
          onPress={() => { hapticFeedback.medium(); setShowDeleteModal(true); }}
          style={({ pressed }) => [styles.dangerLink, pressed && { opacity: 0.6 }]}
        >
          <Trash2 size={18} color={c.danger} strokeWidth={2.2} />
          <Text style={[coralText.label, { fontSize: 15.5, color: c.danger, textDecorationLine: 'underline' }]}>Eliminar mi cuenta y mis datos</Text>
        </Pressable>
      </View>

      <Dialog
        visible={confirmDownload}
        onClose={() => setConfirmDownload(false)}
        titlePrefix="Descargar tus "
        titleAccent="datos"
        description="Prepararemos un archivo con tu cuenta, tus preferencias, tus prendas y enlaces a tus fotografías. Podrás guardarlo o compartirlo desde tu teléfono."
        actions={<>
          <CoralButton
            title="Descargar"
            leftIcon={<Download size={18} color={c.onPrimary} strokeWidth={2.2} />}
            onPress={() => { setConfirmDownload(false); hapticFeedback.medium(); void onDownloadData?.(); }}
            fullWidth
          />
          <CoralButton title="Cancelar" variant="secondary" onPress={() => setConfirmDownload(false)} fullWidth />
        </>}
      />

      <Dialog
        visible={showDeleteModal}
        onClose={closeDelete}
        titlePrefix="¿Eliminar tu "
        titleAccent="cuenta"
        titleSuffix="?"
        description="Borraremos para siempre tu cuenta, tus datos personales, preferencias, prendas y fotografías, también las de este dispositivo. No podrás volver a entrar con esta cuenta."
        actions={<>
          <ButtonDanger
            title="Eliminar cuenta y datos"
            leftIcon={<Trash2 size={18} color={colors.text.onDanger} strokeWidth={2.2} />}
            loading={deleting}
            disabled={deleting || !deletePassword}
            onPress={() => { void onDeleteDataConfirm?.(deletePassword); }}
            accessibilityLabel="Confirmar eliminación permanente de la cuenta y sus datos"
            fullWidth
          />
          <CoralButton title="Cancelar" variant="secondary" disabled={deleting} onPress={closeDelete} fullWidth />
        </>}
      >
        <PasswordInput
          {...field}
          label="Tu contraseña actual"
          leftIcon={<Lock size={18} color={iconColor} />}
          value={deletePassword}
          onChangeText={setDeletePassword}
          autoComplete="current-password"
          accessibilityLabel="Contraseña actual para confirmar"
        />
        {deleteError ? (
          <View accessibilityRole="alert" style={[styles.deleteError, { backgroundColor: c.dangerBg, borderColor: c.danger }]}>
            <CircleAlert size={18} color={c.danger} strokeWidth={2.3} />
            <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{deleteError}</Text>
          </View>
        ) : null}
      </Dialog>
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { gap: 18 },
  top: { minHeight: 44, flexDirection: 'row' },
  header: { gap: 8, alignItems: 'center', paddingHorizontal: 8 },
  mascot: { alignSelf: 'center' },
  section: { gap: 12 },
  list: { paddingHorizontal: 16 },
  permission: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  switchSlot: { width: 52, height: 30 },
  loading: { alignItems: 'center', gap: 10 },
  dataCard: { gap: 6 },
  dataRow: { gap: 2, paddingVertical: 4 },
  divider: { height: 1, marginVertical: 6 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 4, marginTop: 4, alignItems: 'center' },
  dangerLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8 },
  deleteError: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
});
