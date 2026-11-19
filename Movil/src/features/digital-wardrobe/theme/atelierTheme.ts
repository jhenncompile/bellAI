import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/shared/theme/ThemeContext';

/**
 * Convierte un color `#RRGGBB` a `rgba()` con la opacidad indicada.
 * Si el color ya no es hexadecimal se devuelve tal cual.
 */
function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Paleta del Armario Digital. Conserva los nombres de tokens del diseno anterior
 * (para no reescribir cada pantalla) pero sus valores salen del tema global AURA,
 * por lo que respeta el modo oscuro / claro de la app.
 */
export interface AtelierPalette {
  bgLinen: string;
  bgSilk: string;
  bgSand: string;
  surfaceWhite: string;
  surfaceWarm: string;
  terracotta: string;
  terracottaDark: string;
  roseDust: string;
  roseBlush: string;
  espresso: string;
  mocha: string;
  taupe: string;
  sage: string;
  sageLight: string;
  sageBorder: string;
  amber: string;
  amberLight: string;
  amberBorder: string;
  burgundy: string;
  burgundyLight: string;
  burgundyBorder: string;
  /** Texto sobre fondos de acento (botones y chips activos). */
  onAccent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  warning: string;
}

export function useAtelierPalette(): AtelierPalette {
  const { colors: c } = useTheme();

  return useMemo<AtelierPalette>(
    () => ({
      bgLinen: c.background.primary,
      bgSilk: c.isDark ? 'rgba(255, 255, 255, 0.06)' : c.background.tertiary,
      bgSand: c.border.medium,
      surfaceWhite: c.isDark ? c.background.tertiary : c.background.secondary,
      surfaceWarm: c.background.secondary,
      terracotta: c.brand.primary,
      terracottaDark: c.text.accent,
      roseDust: c.border.active,
      roseBlush: withAlpha(c.brand.primary, 0.16),
      espresso: c.text.primary,
      mocha: c.text.secondary,
      taupe: c.text.muted,
      sage: c.status.success,
      sageLight: withAlpha(c.status.success, 0.15),
      sageBorder: withAlpha(c.status.success, 0.4),
      amber: c.status.warning,
      amberLight: withAlpha(c.status.warning, 0.15),
      amberBorder: withAlpha(c.status.warning, 0.4),
      burgundy: c.status.error,
      burgundyLight: withAlpha(c.status.error, 0.15),
      burgundyBorder: withAlpha(c.status.error, 0.4),
      onAccent: '#FFFFFF',
      textPrimary: c.text.primary,
      textSecondary: c.text.secondary,
      textMuted: c.text.muted,
      warning: c.status.warning,
    }),
    [c],
  );
}

export const atelierTypography = {
  serifFamily: undefined as string | undefined,
  sansFamily: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
} as const;

export const atelierSpacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

export const atelierRadii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const atelierShadows = {
  softCard: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  floatingBar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryButton: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
