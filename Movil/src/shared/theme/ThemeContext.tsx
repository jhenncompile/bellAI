import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './tokens/colors';
import { shapes } from './tokens/shapes';
import { createGlassTokens } from './tokens/glass';
import { createShadowTokens } from './tokens/shadows';
import { themeSpacing } from './tokens/spacing';
import { themeTypography } from './tokens/typography';
import { motion } from './tokens/motion';
import { AppTheme, ThemeContextValue, ThemeMode } from './types';

const THEME_STORAGE_KEY = '@aura_theme_mode';

export const createAppTheme = (mode: ThemeMode): AppTheme => {
  const isDark = mode === 'dark';
  return {
    mode,
    isDark,
    colors: isDark ? darkColors : lightColors,
    shapes,
    glass: createGlassTokens(isDark),
    shadows: createShadowTokens(isDark),
    spacing: themeSpacing,
    typography: themeTypography,
    motion,
  };
};

export const darkTheme = createAppTheme('dark');
export const lightTheme = createAppTheme('light');

export const defaultThemeContextValue: ThemeContextValue = {
  theme: lightTheme,
  colors: lightTheme.colors,
  shapes: lightTheme.shapes,
  glass: lightTheme.glass,
  shadows: lightTheme.shadows,
  spacing: lightTheme.spacing,
  typography: lightTheme.typography,
  motion: lightTheme.motion,
  isDark: false,
  mode: 'light',
  toggleTheme: () => {},
  setMode: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultThemeContextValue);

/**
 * Modo oscuro desactivado mientras se rediseñan los flujos (design.md, sección 33, decisión 3).
 * El tema oscuro se conserva en `colors.ts`; para reactivarlo basta con poner `true`.
 */
export const DARK_MODE_ENABLED = false;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  // Preferencia guardada por la persona. Mientras sea null, el tema sigue al sistema.
  const [savedMode, setSavedMode] = useState<ThemeMode | null>(null);
  const preferred: ThemeMode = savedMode ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const mode: ThemeMode = DARK_MODE_ENABLED ? preferred : 'light';

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setSavedMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.error('Error guardando tema:', e);
    }

  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  useEffect(() => {
    let isMounted = true;
    const loadSaved = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!isMounted) return;
        if (saved === 'dark' || saved === 'light') {
          setSavedMode(saved);
        }
      } catch {
        // Sin preferencia legible: se sigue el tema del sistema.
      }
    };
    loadSaved();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeTheme = useMemo(() => createAppTheme(mode), [mode]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme: activeTheme,
      colors: activeTheme.colors,
      shapes: activeTheme.shapes,
      glass: activeTheme.glass,
      shadows: activeTheme.shadows,
      spacing: activeTheme.spacing,
      typography: activeTheme.typography,
      motion: activeTheme.motion,
      isDark: activeTheme.isDark,
      mode,
      toggleTheme,
      setMode,
    }),
    [activeTheme, mode, toggleTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

// Exportaciones de compatibilidad hacia atrás
export { darkColors as darkThemeColors, lightColors as lightThemeColors };
export type { ThemeColors, AppTheme, ThemeMode, ThemeContextValue };
