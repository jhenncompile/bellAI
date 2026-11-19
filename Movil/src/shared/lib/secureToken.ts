import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Único lugar donde se guarda el token de sesión (HU-034).
 * En Android/iOS usa el almacén cifrado del sistema (Keystore / Keychain).
 * En web, donde no existe, recurre a AsyncStorage.
 */
const KEY = 'bellai_auth_token';
const LEGACY_KEYS = ['@bellia_atelier:auth_token'];
const useSecure = Platform.OS === 'android' || Platform.OS === 'ios';

export const secureToken = {
  async get(): Promise<string | null> {
    try {
      const value = useSecure ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(KEY);
      if (value) return value;
      // Migración: tokens guardados antes en texto plano
      for (const legacy of LEGACY_KEYS) {
        const old = await AsyncStorage.getItem(legacy);
        if (old) {
          await this.set(old);
          await AsyncStorage.removeItem(legacy);
          return old;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async set(token: string): Promise<void> {
    if (useSecure) await SecureStore.setItemAsync(KEY, token);
    else await AsyncStorage.setItem(KEY, token);
  },

  async clear(): Promise<void> {
    try {
      if (useSecure) await SecureStore.deleteItemAsync(KEY);
      else await AsyncStorage.removeItem(KEY);
      await Promise.all(LEGACY_KEYS.map((k) => AsyncStorage.removeItem(k)));
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar
    }
  },
};
