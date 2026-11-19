import { secureToken } from '@/shared/lib/secureToken';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WardrobeHistoryEntry,
  WardrobeItem,
  WardrobeSyncSnapshot,
  WardrobeSyncStatus,
} from '../types/wardrobe.types';
import { getUserSession } from '@/entities/user/model/storage';

const STORAGE_KEYS = {
  BACKEND_ORIGIN: '@bellia_atelier:backend_origin',
  SYNC_SNAPSHOT: '@bellia_atelier:wardrobe_sync_snapshot',
  LOCAL_DRAFTS: '@bellia_atelier:local_offline_drafts',
  AUTH_TOKEN: '@bellia_atelier:auth_token',
} as const;

let activeAccountId: string | null = null;

function getAccountStorageKey(key: string, accountId: string): string {
  return `${key}:${encodeURIComponent(accountId)}`;
}

async function getAccountScopedStorageKey(key: string): Promise<string | null> {
  if (!activeAccountId) return null;

  const session = await getUserSession();
  if (!session?.isAuthenticated || session.user?.id !== activeAccountId) {
    return null;
  }

  return getAccountStorageKey(key, activeAccountId);
}

/**
 * Servicio de almacenamiento local y sincronización sin conexión (HU-040 y HU-009).
 * - Conserva sesión y datos de la cuenta entre sesiones y dispositivos.
 * - Mantiene copia local del armario, estado de sincronización e historial para consulta sin conexión.
 * - Conserva borradores locales si una subida de fotografía falla por corte total de red.
 */
export const offlineSyncStorage = {
  async setAccountId(accountId: string | null): Promise<void> {
    activeAccountId = accountId;
    if (!accountId) return;

    for (const key of [STORAGE_KEYS.SYNC_SNAPSHOT, STORAGE_KEYS.LOCAL_DRAFTS]) {
      const accountKey = getAccountStorageKey(key, accountId);
      const accountData = await AsyncStorage.getItem(accountKey);
      const legacyData = await AsyncStorage.getItem(key);
      let migratedLegacyData = false;
      if (accountData === null && legacyData !== null) {
        try {
          if (key === STORAGE_KEYS.SYNC_SNAPSHOT) {
            const legacySnapshot = JSON.parse(legacyData) as WardrobeSyncSnapshot;
            migratedLegacyData = legacySnapshot.account?.id === accountId;
          } else {
            const legacyDrafts: unknown = JSON.parse(legacyData);
            migratedLegacyData =
              Array.isArray(legacyDrafts) &&
              legacyDrafts.every(
                (draft) =>
                  typeof draft === 'object' &&
                  draft !== null &&
                  'userId' in draft &&
                  draft.userId === accountId,
              );
          }
        } catch (error) {
          console.warn('[offlineSyncStorage] No se pudo validar el cache legado del armario:', error);
        }
      }
      if (migratedLegacyData && legacyData !== null) {
        await AsyncStorage.setItem(accountKey, legacyData);
      }
      if (legacyData !== null) {
        if (accountData === null && !migratedLegacyData) {
          console.warn('[offlineSyncStorage] Se descartaron datos locales sin cuenta verificable.');
        }
        await AsyncStorage.removeItem(key);
      }
    }
  },

  /**
   * Borra la copia local del armario y los borradores. Se llama al cerrar sesión para que
   * otra cuenta en el mismo teléfono no vea las prendas de la anterior.
   */
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SYNC_SNAPSHOT,
      STORAGE_KEYS.LOCAL_DRAFTS,
      // Clave antigua donde se esperaba el token; se limpia por si quedó en algún dispositivo
      '@bellia_atelier:auth_token',
    ]);
  },

  // HU-034: el token vive en SecureStore (cifrado por el sistema), no en AsyncStorage
  async saveToken(token: string): Promise<void> {
    await secureToken.set(token);
  },

  async getToken(): Promise<string | null> {
    return secureToken.get();
  },

  async clearToken(): Promise<void> {
    await secureToken.clear();
  },

  async clearPersonalData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.SYNC_SNAPSHOT,
      STORAGE_KEYS.LOCAL_DRAFTS,
      ...(activeAccountId
        ? [
            getAccountStorageKey(STORAGE_KEYS.SYNC_SNAPSHOT, activeAccountId),
            getAccountStorageKey(STORAGE_KEYS.LOCAL_DRAFTS, activeAccountId),
          ]
        : []),
    ]);
  },

  async saveBackendOrigin(origin: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.BACKEND_ORIGIN, origin);
  },

  async getBackendOrigin(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.BACKEND_ORIGIN);
  },

  /**
   * Guarda el paquete completo de sincronización (HU-040: cuenta, syncStatus, armario e historial).
   */
  async saveSyncSnapshot(snapshot: WardrobeSyncSnapshot): Promise<void> {
    const key = await getAccountScopedStorageKey(STORAGE_KEYS.SYNC_SNAPSHOT);
    if (!key) throw new Error('No se puede guardar la sincronización sin una sesión de usuario.');
    await AsyncStorage.setItem(key, JSON.stringify(snapshot));
  },

  async getSyncSnapshot(): Promise<WardrobeSyncSnapshot | null> {
    const key = await getAccountScopedStorageKey(STORAGE_KEYS.SYNC_SNAPSHOT);
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WardrobeSyncSnapshot;
    } catch {
      return null;
    }
  },

  /**
   * Actualiza los artículos o el historial dentro del snapshot local cuando se agrega/edita/elimina
   * una prenda, garantizando que el modo sin conexión siempre tenga el último estado.
   */
  async patchCachedWardrobeItems(
    updater: (items: WardrobeItem[], history: WardrobeHistoryEntry[]) => {
      items: WardrobeItem[];
      history?: WardrobeHistoryEntry[];
      syncStatus?: Partial<WardrobeSyncStatus>;
    },
  ): Promise<void> {
    const existing = await this.getSyncSnapshot();
    if (!existing) return;

    const currentItems = existing.wardrobe?.items || [];
    const currentHistory = existing.history || [];
    const result = updater(currentItems, currentHistory);

    const nextItems = result.items;
    const nextGrid = nextItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      categoryLabel: item.bottomDetails.categoryLabel,
      photoUrl: item.enhancedImageUrl || item.originalImageUrl,
      imageUrl: item.enhancedImageUrl || item.originalImageUrl,
      color: item.bottomDetails.color,
      colorHex: item.bottomDetails.colorHex,
      season: item.bottomDetails.season,
      status: item.status,
      addedAt: item.usageStats.addedAt,
      lastWornAt: item.usageStats.lastWornAt,
    }));

    const nextSnapshot: WardrobeSyncSnapshot = {
      ...existing,
      syncStatus: {
        ...existing.syncStatus,
        ...(result.syncStatus || {}),
        lastSyncedAt: new Date().toISOString(),
      },
      wardrobe: {
        ...existing.wardrobe,
        isEmpty: nextItems.length === 0,
        grid: nextGrid,
        items: nextItems,
      },
      history: result.history ?? currentHistory,
    };

    await this.saveSyncSnapshot(nextSnapshot);
  },

  /**
   * Conserva un borrador local en el teléfono cuando una subida falla por falta total de red (HU-009).
   */
  async saveLocalOfflineDraft(draft: WardrobeItem): Promise<void> {
    const current = await this.getLocalOfflineDrafts();
    const filtered = current.filter((d) => d.id !== draft.id);
    const key = await getAccountScopedStorageKey(STORAGE_KEYS.LOCAL_DRAFTS);
    if (!key) throw new Error('No se puede guardar el borrador sin una sesión de usuario.');
    await AsyncStorage.setItem(
      key,
      JSON.stringify([draft, ...filtered]),
    );
  },

  async getLocalOfflineDrafts(): Promise<WardrobeItem[]> {
    const key = await getAccountScopedStorageKey(STORAGE_KEYS.LOCAL_DRAFTS);
    if (!key) return [];
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as WardrobeItem[];
    } catch {
      return [];
    }
  },

  async removeLocalOfflineDraft(draftId: string): Promise<void> {
    const key = await getAccountScopedStorageKey(STORAGE_KEYS.LOCAL_DRAFTS);
    if (!key) return;
    const current = await this.getLocalOfflineDrafts();
    const filtered = current.filter((d) => d.id !== draftId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  },
};
