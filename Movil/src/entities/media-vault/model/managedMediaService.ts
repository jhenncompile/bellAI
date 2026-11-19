import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'bellai-media.db';
const ALBUM_NAME = 'BellAI';
const MEDIA_ROOT = `${FileSystem.documentDirectory}bellai_media/`;

type ManagedMediaRow = {
  id: string;
  account_id: string;
  local_uri: string;
  gallery_asset_id: string | null;
};

type ManagedCapture = {
  id: string;
  localUri: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function safeAccountDirectory(accountId: string): string {
  return encodeURIComponent(accountId).replace(/%/g, '_');
}

function extensionFor(uri: string): string {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS managed_media (
          id TEXT PRIMARY KEY NOT NULL,
          account_id TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          enhanced_url TEXT,
          gallery_asset_id TEXT,
          garment_id TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_managed_media_account ON managed_media(account_id);
      `);
      return database;
    })();
  }

  return databasePromise;
}

async function ensureDirectory(directory: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
}

/**
 * Conserva las capturas originales dentro del espacio privado de BellAI y exporta
 * únicamente el resultado mejorado al álbum administrado por la aplicación.
 */
export const managedMediaService = {
  async preserveCapture(sourceUri: string, accountId: string): Promise<ManagedCapture> {
    const database = await getDatabase();
    const existing = await database.getFirstAsync<ManagedMediaRow>(
      'SELECT id, account_id, local_uri, gallery_asset_id FROM managed_media WHERE local_uri = ? LIMIT 1',
      sourceUri,
    );
    if (existing) {
      return { id: existing.id, localUri: existing.local_uri };
    }

    const directory = `${MEDIA_ROOT}${safeAccountDirectory(accountId)}/`;
    await ensureDirectory(directory);
    const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localUri = `${directory}${id}.${extensionFor(sourceUri)}`;
    await FileSystem.copyAsync({ from: sourceUri, to: localUri });

    await database.runAsync(
      `INSERT INTO managed_media (id, account_id, local_uri, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      id,
      accountId,
      localUri,
      new Date().toISOString(),
    );

    return { id, localUri };
  },

  async publishEnhancedCapture(
    captureId: string,
    enhancedUrl: string | null | undefined,
    garmentId?: string,
  ): Promise<void> {
    if (!enhancedUrl || Platform.OS === 'web') return;

    const database = await getDatabase();
    const capture = await database.getFirstAsync<ManagedMediaRow>(
      'SELECT id, account_id, local_uri, gallery_asset_id FROM managed_media WHERE id = ? LIMIT 1',
      captureId,
    );
    if (!capture || capture.gallery_asset_id) return;

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (permission.status !== 'granted') {
        await database.runAsync(
          "UPDATE managed_media SET enhanced_url = ?, garment_id = ?, status = 'gallery_permission_denied' WHERE id = ?",
          enhancedUrl,
          garmentId || null,
          captureId,
        );
        return;
      }

      const enhancedDirectory = `${MEDIA_ROOT}${safeAccountDirectory(capture.account_id)}/enhanced/`;
      await ensureDirectory(enhancedDirectory);
      const downloadUri = `${enhancedDirectory}${captureId}.jpg`;
      const download = await FileSystem.downloadAsync(enhancedUrl, downloadUri);
      const asset = await MediaLibrary.createAssetAsync(download.uri);
      const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
      }

      await database.runAsync(
        "UPDATE managed_media SET enhanced_url = ?, gallery_asset_id = ?, garment_id = ?, status = 'published' WHERE id = ?",
        enhancedUrl,
        asset.id,
        garmentId || null,
        captureId,
      );
    } catch (error) {
      console.warn('[managedMediaService] No se pudo guardar la imagen mejorada en la galería:', error);
      await database.runAsync(
        "UPDATE managed_media SET enhanced_url = ?, garment_id = ?, status = 'gallery_pending' WHERE id = ?",
        enhancedUrl,
        garmentId || null,
        captureId,
      );
    }
  },

  async removeAccountMedia(accountId: string): Promise<void> {
    const database = await getDatabase();
    const captures = await database.getAllAsync<ManagedMediaRow>(
      'SELECT id, account_id, local_uri, gallery_asset_id FROM managed_media WHERE account_id = ?',
      accountId,
    );

    // No olvidamos los IDs si el sistema rechaza una eliminación: conservar el
    // registro permite reintentarlo en el próximo cierre de sesión.
    await Promise.all(
      captures
        .filter((capture: ManagedMediaRow) => capture.gallery_asset_id)
        .map((capture: ManagedMediaRow) => MediaLibrary.deleteAssetsAsync(capture.gallery_asset_id as string)),
    );
    await Promise.all(
      captures.map((capture: ManagedMediaRow) => FileSystem.deleteAsync(capture.local_uri, { idempotent: true })),
    );
    await FileSystem.deleteAsync(`${MEDIA_ROOT}${safeAccountDirectory(accountId)}/`, { idempotent: true });
    await database.runAsync('DELETE FROM managed_media WHERE account_id = ?', accountId);
  },
};
