import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { getUserProfile } from '@/entities/user/model/storage';

/**
 * HU-01 (criterio 4): ninguna usuaria puede ver la información de otra cuenta.
 *
 * Varias partes de la app guardan datos personales sólo en el teléfono (perfil y colorimetría,
 * memoria de AURA, objetivo activo, armario local y la bóveda de fotos). Esas claves no llevan
 * el id de la cuenta, así que si otra persona inicia sesión en el mismo teléfono los vería.
 *
 * Se anota a qué cuenta pertenecen los datos locales y, cuando entra una cuenta distinta,
 * se borran antes de mostrar nada. Si vuelve a entrar la misma usuaria, sus datos siguen ahí.
 */

const OWNER_KEY = '@bellia:local_data_owner';

/** Claves locales con datos de la cuenta (definidas en sus respectivos servicios). */
const ACCOUNT_SCOPED_KEYS = [
  '@aura_user_profile_v1', // entities/user/model/storage.ts
  '@aura_memory_state_v1', // entities/memory/model/auraMemoryService.ts
  '@aura_goal_active_v1', // entities/goal/model/auraGoalService.ts
  '@aura_wardrobe_items_v1', // features/wardrobe-matching/api/wardrobeService.ts
  '@aura_vault_index_v1', // entities/media-vault/model/mediaVaultService.ts
  '@bellia_atelier:wardrobe_sync_snapshot', // features/digital-wardrobe/storage/offlineSyncStorage.ts
  '@bellia_atelier:local_offline_drafts',
];

const VAULT_ROOT = `${FileSystem.documentDirectory}aura_vault/`;

async function currentOwner(): Promise<string | null> {
  const owner = await AsyncStorage.getItem(OWNER_KEY);
  if (owner) return owner;
  // Datos guardados antes de existir la marca: el perfil local indica a quién pertenecen
  const profile = await getUserProfile();
  return profile.id && profile.id !== 'usr_guest' ? profile.id : null;
}

/** Borra todos los datos personales guardados en el teléfono. */
export async function wipeAccountLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([...ACCOUNT_SCOPED_KEYS, OWNER_KEY]);
  try {
    await FileSystem.deleteAsync(VAULT_ROOT, { idempotent: true });
  } catch {
    // Si no se pueden borrar las fotos, el índice ya no existe y la app no las muestra
  }
}

/**
 * Llamar justo después de autenticar y antes de leer o guardar el perfil local.
 * Si los datos del teléfono son de otra cuenta, se borran.
 */
export async function claimLocalDataFor(userId: string): Promise<void> {
  const owner = await currentOwner();
  if (owner && owner !== userId) {
    await wipeAccountLocalData();
  }
  await AsyncStorage.setItem(OWNER_KEY, userId);
}
