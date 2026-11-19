export const opacities = {
  faint: 0.04,
  subtle: 0.08,
  light: 0.15,
  medium: 0.3,
  high: 0.68,
  heavy: 0.75,
  opaque: 1,
} as const;

export type OpacityLevel = keyof typeof opacities;

export interface GlassTokens {
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  border: string;
  borderActive: string;
  overlay: string;
  /** Intensidad del desenfoque de tarjetas (`BlurView`, 1 a 100). */
  blurIntensity: number;
  /** Intensidad del desenfoque de la barra de pestañas. */
  blurIntensityBar: number;
  /** Tinte del `BlurView`. */
  blurTint: 'light' | 'dark';
}

// Sistema P1: superficies blancas sólidas; el «vidrio» ya no es translúcido.
export const lightGlass: GlassTokens = {
  surface: '#FFFFFF', // surface.card
  surfaceElevated: '#FFFFFF', // surface.input
  surfaceHighlight: 'rgba(255, 111, 97, 0.12)', // Acento coral sutil
  border: '#FFFFFF', // border.glass
  borderActive: '#2A1714', // border.focus
  overlay: 'rgba(42, 23, 20, 0.5)', // velo modal
  blurIntensity: 14,
  blurIntensityBar: 18,
  blurTint: 'light',
};

export const darkGlass: GlassTokens = {
  surface: 'rgba(255, 255, 255, 0.10)',
  surfaceElevated: 'rgba(255, 255, 255, 0.10)',
  surfaceHighlight: 'rgba(232, 137, 159, 0.16)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderActive: '#F4A6B8',
  overlay: 'rgba(0, 0, 0, 0.6)',
  blurIntensity: 14,
  blurIntensityBar: 18,
  blurTint: 'dark',
};

export interface ThemeGlass extends GlassTokens {
  opacities: typeof opacities;
}

export const createGlassTokens = (isDark: boolean): ThemeGlass => ({
  ...(isDark ? darkGlass : lightGlass),
  opacities,
});

export const glass = createGlassTokens(false);
