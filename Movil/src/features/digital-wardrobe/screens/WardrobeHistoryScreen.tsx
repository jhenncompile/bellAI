import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Cloud, CloudOff } from 'lucide-react-native';
import { AtelierButton } from '../components/AtelierButton';
import { AtelierScreen } from '../components/AtelierScreen';
import { WarmSwitchTile } from '../components/WarmSwitchTile';
import {
  AtelierPalette,
  atelierRadii,
  atelierShadows,
  atelierTypography,
  useAtelierPalette,
} from '../theme/atelierTheme';
import { wardrobeService } from '../services/wardrobeService';
import { WardrobeHistoryEntry, WardrobeSyncStatus } from '../types/wardrobe.types';

interface WardrobeHistoryScreenProps {
  onBack: () => void;
}

function formatSyncTimestamp(iso?: string | null): string {
  if (!iso) return 'Pendiente de primera sincronización';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getActionBadgeConfig(
  actionType: WardrobeHistoryEntry['actionType'],
  c: AtelierPalette,
) {
  switch (actionType) {
    case 'agregar':
      return { label: 'Agregar', bg: c.sageLight, color: c.sage };
    case 'editar':
      return { label: 'Editar', bg: c.roseBlush, color: c.terracottaDark };
    case 'eliminar':
      return { label: 'Eliminar', bg: c.amberLight, color: c.amber };
    case 'usar':
    default:
      return { label: 'Usada', bg: c.bgSilk, color: c.mocha };
  }
}

/**
 * Historial y respaldo del Armario Digital (HU-040):
 * - Estado visible de la última sincronización.
 * - Interruptores de Copia automática en la nube y Modo sin conexión.
 * - Lista cronológica de acciones (agregar, editar, eliminar, usar) con su fecha.
 */
export const WardrobeHistoryScreen: React.FC<WardrobeHistoryScreenProps> = ({ onBack }) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);

  const [syncStatus, setSyncStatus] = useState<WardrobeSyncStatus>({
    cloudAvailable: true,
    autoBackupEnabled: true,
    offlineModeEnabled: true,
    lastSyncedAt: null,
  });
  const [history, setHistory] = useState<WardrobeHistoryEntry[]>([]);
  const [fromOfflineCache, setFromOfflineCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadSnapshotAndHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { snapshot, fromOfflineCache: isOffline } =
        await wardrobeService.fetchSyncSnapshot();
      setSyncStatus(snapshot.syncStatus);
      setHistory(snapshot.history || []);
      setFromOfflineCache(isOffline);
    } catch {
      // Sin red y sin copia local previa: se conserva el estado vacío por defecto.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshotAndHistory();
  }, [loadSnapshotAndHistory]);

  const handleToggle = async (
    key: 'autoBackupEnabled' | 'offlineModeEnabled',
    nextVal: boolean,
  ) => {
    setSyncStatus((prev: WardrobeSyncStatus) => ({ ...prev, [key]: nextVal }));
    setSavingSettings(true);
    try {
      const res = await wardrobeService.updateSyncSettings({ [key]: nextVal });
      setSyncStatus(res.syncStatus);
      setFeedbackMsg(
        key === 'autoBackupEnabled'
          ? nextVal
            ? 'Copia automática en la nube activada.'
            : 'Copia automática en la nube pausada.'
          : nextVal
            ? 'Modo sin conexión activado: tu armario está disponible sin red.'
            : 'Modo sin conexión desactivado.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const online = syncStatus.cloudAvailable && !fromOfflineCache;

  return (
    <AtelierScreen
      subtitle="Sincronización y Respaldo"
      title="Historial del armario"
      rightSlot={
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.syncCard}>
        <View style={[styles.cloudBadge, online ? styles.cloudBadgeOnline : styles.cloudBadgeOffline, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
          {online ? (
            <Cloud size={12} color={atelierColors.terracotta} />
          ) : (
            <CloudOff size={12} color={atelierColors.textSecondary} />
          )}
          <Text
            style={[
              styles.cloudBadgeText,
              online ? styles.cloudBadgeTextOnline : styles.cloudBadgeTextOffline,
            ]}
          >
            {online ? 'Respaldado' : 'Copia local'}
          </Text>
        </View>
        <Text style={styles.syncTimestampText}>
          Última sincronización: {formatSyncTimestamp(syncStatus.lastSyncedAt)}
        </Text>
        <AtelierButton
          title="Sincronizar ahora"
          compact
          variant="outline"
          onPress={loadSnapshotAndHistory}
        />
      </View>

      {feedbackMsg ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{feedbackMsg}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionHeaderTitle}>Disponibilidad y Respaldo</Text>
      <WarmSwitchTile
        title="Copia automática en la nube"
        description="Respalda tus prendas, fotos de estudio y ediciones al instante entre sesiones y dispositivos."
        value={syncStatus.autoBackupEnabled}
        onValueChange={(v) => handleToggle('autoBackupEnabled', v)}
        disabled={savingSettings}
      />
      <WarmSwitchTile
        title="Modo sin conexión (Offline)"
        description="Conserva una copia segura en tu teléfono para consultar tu armario y guardar borradores sin red."
        value={syncStatus.offlineModeEnabled}
        onValueChange={(v) => handleToggle('offlineModeEnabled', v)}
        disabled={savingSettings}
      />

      <View style={styles.historySectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Historial de acciones</Text>
        <Text style={styles.historyCountText}>{history.length} registros</Text>
      </View>

      <View style={styles.historyCard}>
        {loading ? (
          <View style={styles.historyLoader}>
            <ActivityIndicator size="small" color={atelierColors.terracotta} />
            <Text style={styles.historyEmptyText}>Cargando historial de tu armario...</Text>
          </View>
        ) : history.length === 0 ? (
          <Text style={styles.historyEmptyText}>
            Aún no hay acciones registradas. Cuando agregues, edites o elimines prendas, aparecerán aquí con su fecha.
          </Text>
        ) : (
          history.map((entry, idx) => {
            const badge = getActionBadgeConfig(entry.actionType, atelierColors);
            const isLast = idx === history.length - 1;
            return (
              <View key={entry.id} style={[styles.historyRow, isLast && styles.historyRowLast]}>
                <View style={styles.historyLeftCol}>
                  <View style={styles.historyTitleLine}>
                    <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.actionBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.historyItemName}>
                      {entry.itemName || entry.description}
                    </Text>
                  </View>
                  <Text style={styles.historyDescription}>{entry.description}</Text>
                </View>
                <Text style={styles.historyDateText}>{formatSyncTimestamp(entry.occurredAt)}</Text>
              </View>
            );
          })
        )}
      </View>
    </AtelierScreen>
  );
};

const createStyles = (atelierColors: AtelierPalette) =>
  StyleSheet.create({
    backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    backBtnText: { fontSize: 13, fontWeight: '700', color: atelierColors.mocha },
    syncCard: {
      backgroundColor: atelierColors.surfaceWhite,
      borderWidth: 1,
      borderColor: atelierColors.bgSand,
      borderRadius: atelierRadii.xl,
      padding: 16,
      marginBottom: 14,
      gap: 10,
      ...atelierShadows.softCard,
    },
    cloudBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: atelierRadii.pill,
    },
    cloudBadgeOnline: { backgroundColor: atelierColors.sageLight },
    cloudBadgeOffline: { backgroundColor: atelierColors.amberLight },
    cloudBadgeText: { fontSize: 11.5, fontWeight: '700' },
    cloudBadgeTextOnline: { color: atelierColors.sage },
    cloudBadgeTextOffline: { color: atelierColors.amber },
    syncTimestampText: { fontSize: 12, fontWeight: '700', color: atelierColors.mocha },
    feedbackBanner: {
      backgroundColor: atelierColors.sageLight,
      borderWidth: 1,
      borderColor: atelierColors.sageBorder,
      borderRadius: atelierRadii.md,
      padding: 10,
      marginBottom: 12,
    },
    feedbackText: { fontSize: 12.5, fontWeight: '700', color: atelierColors.espresso },
    sectionHeaderTitle: {
      fontFamily: atelierTypography.serifFamily,
      fontSize: 18,
      fontWeight: '700',
      color: atelierColors.espresso,
      marginBottom: 8,
      marginTop: 4,
    },
    historySectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    historyCountText: { fontSize: 12, fontWeight: '700', color: atelierColors.taupe },
    historyCard: {
      backgroundColor: atelierColors.surfaceWhite,
      borderWidth: 1,
      borderColor: atelierColors.bgSand,
      borderRadius: atelierRadii.xl,
      padding: 14,
      marginBottom: 18,
      ...atelierShadows.softCard,
    },
    historyLoader: { paddingVertical: 16, alignItems: 'center', gap: 8 },
    historyEmptyText: {
      fontSize: 12.5,
      color: atelierColors.mocha,
      textAlign: 'center',
      lineHeight: 18,
      paddingVertical: 10,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: atelierColors.bgSilk,
    },
    historyRowLast: { borderBottomWidth: 0 },
    historyLeftCol: { flex: 1, paddingRight: 10 },
    historyTitleLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    actionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: atelierRadii.pill,
      marginRight: 7,
    },
    actionBadgeText: { fontSize: 11, fontWeight: '700' },
    historyItemName: { fontSize: 13, fontWeight: '700', color: atelierColors.espresso, flex: 1 },
    historyDescription: { fontSize: 11.5, color: atelierColors.mocha },
    historyDateText: { fontSize: 11, color: atelierColors.taupe, fontWeight: '600' },
  });
