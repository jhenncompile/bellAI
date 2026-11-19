import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { clearNotifications } from '@/features/notifications';
import { UserAccount, UserSession, UserProfile, DEFAULT_USER_PROFILE } from '@/entities/user/model/types';
import {
  getUserSession,
  saveUserSession,
  clearUserSession,
  getUserProfile,
  saveUserProfile,
} from '@/entities/user/model/storage';
import { apiClient, setApiAuthToken, setUnauthorizedHandler } from '@/shared/api/apiClient';
import { offlineSyncStorage } from '@/features/digital-wardrobe/storage/offlineSyncStorage';
import { managedMediaService } from '@/entities/media-vault/model/managedMediaService';

interface AuthApiResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    createdAt?: string;
  };
  token: string;
}

interface AuthContextType {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<UserAccount>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const expiring = useRef(false);

  // HU-01: si el servidor rechaza el token (sesión caducada o cuenta desactivada) se vuelve al
  // inicio de sesión. A diferencia de logout(), no se borran las fotos ni los datos sin conexión
  // de la cuenta: al volver a entrar siguen ahí. Varias peticiones 401 seguidas cierran una sola vez.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiring.current) return;
      expiring.current = true;
      setApiAuthToken(null);
      void Promise.allSettled([clearUserSession(), offlineSyncStorage.clearToken()]).finally(() => {
        setUser(null);
        setIsAuthenticated(false);
        expiring.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Hidratación súper eficiente: 1 sola lectura a AsyncStorage al inicio
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const session = await getUserSession();
        if (isMounted) {
          if (session && session.isAuthenticated && session.user && session.token) {
            await offlineSyncStorage.setAccountId(session.user.id);
            await offlineSyncStorage.saveToken(session.token);
            setApiAuthToken(session.token);
            setUser(session.user);
            setIsAuthenticated(true);
          } else if (session?.isAuthenticated) {
            // Invalida sesiones locales antiguas que no tienen token del backend.
            await clearUserSession();
            await offlineSyncStorage.setAccountId(null);
            await offlineSyncStorage.clearToken();
            setApiAuthToken(null);
            setUser(null);
            setIsAuthenticated(false);
          } else {
            await offlineSyncStorage.setAccountId(null);
            await offlineSyncStorage.clearToken();
            setApiAuthToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Error restaurando sesión:', err);
        if (isMounted) {
          await offlineSyncStorage.setAccountId(null);
          setApiAuthToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Ingresa tu correo electrónico y contraseña' };
    }

    try {
      const { data: response } = await apiClient.post<AuthApiResponse>('/auth/login', {
        email: cleanEmail,
        password,
      });
      if (!response.token || !response.user?.id) {
        return { success: false, error: 'El servidor no devolvió una sesión válida. Inténtalo de nuevo.' };
      }

      const existingProfile = await getUserProfile();
      const profileBelongsToAccount = existingProfile.id === response.user.id;
      const userAccount: UserAccount = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        avatarUri: response.user.avatar,
        createdAt:
          response.user.createdAt ||
          (profileBelongsToAccount ? existingProfile.createdAt : new Date().toISOString()),
      };

      const session: UserSession = {
        user: userAccount,
        isAuthenticated: true,
        token: response.token,
        lastLoginAt: new Date().toISOString(),
      };

      const sessionSaved = await saveUserSession(session);
      if (!sessionSaved) {
        throw new Error('No se pudo guardar la sesión en el dispositivo.');
      }
      await offlineSyncStorage.setAccountId(userAccount.id);
      await offlineSyncStorage.saveToken(response.token);
      setApiAuthToken(response.token);

      // Reutilizar el perfil local solo si pertenece a la misma cuenta.
      const updatedProfile: UserProfile = {
        ...(profileBelongsToAccount ? existingProfile : DEFAULT_USER_PROFILE),
        id: userAccount.id,
        name: userAccount.name,
        email: userAccount.email,
        createdAt: userAccount.createdAt,
      };
      await saveUserProfile(updatedProfile);

      setUser(userAccount);
      setIsAuthenticated(true);

      return { success: true };
    } catch (err: any) {
      console.error('[AuthProvider] Error al iniciar sesión:', err);
      const backendMessage = err?.response?.data?.message;
      return {
        success: false,
        error: Array.isArray(backendMessage)
          ? backendMessage.join('. ')
          : backendMessage || (err?.code === 'ERR_NETWORK'
            ? 'No pudimos conectar. Revisa la dirección del servidor y tu conexión.'
            : 'No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.'),
      };
    }
  };

  const register = async (
    name: string,
    email: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return { success: false, error: 'Ingresa tu nombre completo' };
    }
    if (!cleanEmail) {
      return { success: false, error: 'Ingresa un correo electrónico válido' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    }

    try {
      const { data: response } = await apiClient.post<AuthApiResponse>('/auth/register', {
        name: cleanName,
        email: cleanEmail,
        password,
      });
      if (!response.token || !response.user?.id) {
        return { success: false, error: 'El servidor no devolvió una sesión válida. Inténtalo de nuevo.' };
      }

      const userAccount: UserAccount = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        avatarUri: response.user.avatar,
        createdAt: new Date().toISOString(),
      };

      const session: UserSession = {
        user: userAccount,
        isAuthenticated: true,
        token: response.token,
        lastLoginAt: new Date().toISOString(),
      };

      const sessionSaved = await saveUserSession(session);
      if (!sessionSaved) {
        throw new Error('No se pudo guardar la sesión en el dispositivo.');
      }
      await offlineSyncStorage.setAccountId(userAccount.id);
      await offlineSyncStorage.saveToken(response.token);
      setApiAuthToken(response.token);

      // Crear perfil asociado
      const newProfile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        id: userAccount.id,
        name: userAccount.name,
        email: userAccount.email,
        isOnboarded: false,
        createdAt: userAccount.createdAt,
      };
      await saveUserProfile(newProfile);

      setUser(userAccount);
      setIsAuthenticated(true);

      return { success: true };
    } catch (err: any) {
      console.error('[AuthProvider] Error al registrar usuario:', err);
      const backendMessage = err?.response?.data?.message;
      return {
        success: false,
        error: Array.isArray(backendMessage)
          ? backendMessage.join('. ')
          : backendMessage || (err?.code === 'ERR_NETWORK'
            ? 'No pudimos conectar. Revisa la dirección del servidor y tu conexión.'
            : 'No se pudo crear la cuenta. Revisa tus datos e inténtalo de nuevo.'),
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const accountId = user?.id;
      // Antes de borrar el token de sesión: el servidor necesita saber de quién es el teléfono
      await clearNotifications().catch(() => {});
      const cleanupResults = await Promise.allSettled([
        clearUserSession(),
        offlineSyncStorage.clearToken(),
        ...(accountId ? [managedMediaService.removeAccountMedia(accountId)] : []),
      ]);
      const failures = cleanupResults.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        console.error('[AuthProvider] Error al limpiar datos de sesión:', failures);
      }
    } catch (err) {
      console.error('[AuthProvider] Error al cerrar sesión:', err);
    } finally {
      await offlineSyncStorage.setAccountId(null);
      setApiAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = async (data: Partial<UserAccount>): Promise<void> => {
    if (!user) return;

    try {
      const updatedUser: UserAccount = {
        ...user,
        ...data,
      };

      const session = await getUserSession();
      await saveUserSession({
        user: updatedUser,
        isAuthenticated: true,
        token: session?.token,
        lastLoginAt: new Date().toISOString(),
      });

      // Sincronizar perfil persistente
      const currentProfile = await getUserProfile();
      await saveUserProfile({
        ...currentProfile,
        name: updatedUser.name,
        email: updatedUser.email,
      });

      setUser(updatedUser);
    } catch (err) {
      console.error('[AuthProvider] Error al actualizar usuario:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
