import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, DEFAULT_USER_PROFILE, UserSession } from './types';
import { secureToken } from '@/shared/lib/secureToken';

const USER_PROFILE_KEY = '@aura_user_profile_v1';
const USER_SESSION_KEY = '@aura_auth_session_v1';

export const getUserSession = async (): Promise<UserSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as UserSession;
    // El token vive en el almacén cifrado; las sesiones antiguas lo tenían en texto plano
    if (session.token) {
      await secureToken.set(session.token);
      const { token: _legacy, ...rest } = session;
      await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(rest));
      return session;
    }
    const token = await secureToken.get();
    return token ? { ...session, token } : session;
  } catch (error) {
    console.warn('[Storage] Error leyendo sesion:', error);
    return null;
  }
};

export const saveUserSession = async (session: UserSession): Promise<boolean> => {
  try {
    const { token, ...rest } = session;
    if (token) await secureToken.set(token);
    await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(rest));
    return true;
  } catch (error) {
    console.error('[Storage] Error guardando sesion:', error);
    return false;
  }
};

export const clearUserSession = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(USER_SESSION_KEY);
    await secureToken.clear();
    return true;
  } catch (error) {
    console.error('[Storage] Error limpiando sesion:', error);
    return false;
  }
};

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    return JSON.parse(raw) as UserProfile;
  } catch (error) {
    console.warn('[Storage] Error leyendo perfil:', error);
    return DEFAULT_USER_PROFILE;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (error) {
    console.error('[Storage] Error guardando perfil:', error);
    return false;
  }
};

export const clearUserProfile = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_PROFILE_KEY);
};
