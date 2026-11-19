import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VaultFolderType, VaultItem, VaultStats } from './types';

const VAULT_INDEX_KEY = '@aura_vault_index_v1';
const VAULT_ROOT = `${FileSystem.documentDirectory}aura_vault/`;

export class MediaVaultService {
  /**
   * Asegura que los directorios locales existan
   */
  static async ensureDirectories(): Promise<void> {
    const folders: VaultFolderType[] = ['rostro', 'cuerpo', 'armario'];
    for (const folder of folders) {
      const dirPath = `${VAULT_ROOT}${folder}/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }
    }
  }

  /**
   * Guarda una foto en la bóveda local permanente y registra sus metadatos
   */
  static async saveScanToVault(
    sourceUri: string,
    folder: VaultFolderType,
    summary: string,
    metadata: {
      faceShape?: string;
      season?: string;
      score?: number;
      tags?: string[];
    } = {}
  ): Promise<VaultItem> {
    await this.ensureDirectories();

    const timestamp = new Date().toISOString();
    const dateLabel = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const extension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `scan_${Date.now()}.${extension}`;
    const destinationPath = `${VAULT_ROOT}${folder}/${fileName}`;

    // Copiar permanentemente el archivo al almacenamiento interno del usuario
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationPath,
    });

    const newItem: VaultItem = {
      id: `vault-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      folder,
      fileName,
      localUri: destinationPath,
      timestamp,
      dateLabel,
      summary,
      faceShape: metadata.faceShape,
      season: metadata.season,
      score: metadata.score,
      tags: metadata.tags || [folder],
    };

    const currentItems = await this.getAllItems();
    const updatedItems = [newItem, ...currentItems];
    await AsyncStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(updatedItems));

    return newItem;
  }

  /**
   * Obtiene todos los elementos de la bóveda
   */
  static async getAllItems(): Promise<VaultItem[]> {
    try {
      const raw = await AsyncStorage.getItem(VAULT_INDEX_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error cargando índice de bóveda:', e);
      return [];
    }
  }

  /**
   * Obtiene los elementos filtrados por carpeta (rostro, cuerpo, armario)
   */
  static async getItemsByFolder(folder: VaultFolderType): Promise<VaultItem[]> {
    const all = await this.getAllItems();
    return all.filter((item) => item.folder === folder);
  }

  /**
   * Obtiene estadísticas de almacenamiento local
   */
  static async getVaultStats(): Promise<VaultStats> {
    const items = await this.getAllItems();
    const rostroCount = items.filter((i) => i.folder === 'rostro').length;
    const cuerpoCount = items.filter((i) => i.folder === 'cuerpo').length;
    const armarioCount = items.filter((i) => i.folder === 'armario').length;

    return {
      rostroCount,
      cuerpoCount,
      armarioCount,
      totalSizeMb: Math.round((items.length * 1.8) * 10) / 10, // estimado
    };
  }

  /**
   * Elimina un elemento de la bóveda
   */
  static async deleteItem(id: string): Promise<void> {
    const all = await this.getAllItems();
    const itemToDelete = all.find((i) => i.id === id);
    if (itemToDelete) {
      try {
        await FileSystem.deleteAsync(itemToDelete.localUri, { idempotent: true });
      } catch (e) {
        console.warn('No se pudo borrar archivo físico:', e);
      }
    }
    const updated = all.filter((i) => i.id !== id);
    await AsyncStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(updated));
  }

  static async clearAllItems(): Promise<void> {
    const results = await Promise.allSettled([
      AsyncStorage.removeItem(VAULT_INDEX_KEY),
      FileSystem.deleteAsync(VAULT_ROOT, { idempotent: true }),
    ]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      console.warn('No se pudieron borrar todos los archivos de la bóveda local:', failure.reason);
      throw new Error('No se pudo limpiar toda la bóveda local.');
    }
  }
}
