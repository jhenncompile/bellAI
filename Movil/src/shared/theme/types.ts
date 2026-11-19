import { ThemeColors } from './tokens/colors';
import { ThemeShapes } from './tokens/shapes';
import { ThemeGlass } from './tokens/glass';
import { ThemeShadows } from './tokens/shadows';
import { ThemeSpacing } from './tokens/spacing';
import { ThemeTypography } from './tokens/typography';
import { ThemeMotion } from './tokens/motion';

export type ThemeMode = 'dark' | 'light';

export interface AppTheme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  shapes: ThemeShapes;
  glass: ThemeGlass;
  shadows: ThemeShadows;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  motion: ThemeMotion;
}

export interface ThemeContextValue {
  /** Objeto completo del tema activo */
  theme: AppTheme;
  /** Acceso directo a colores del tema activo */
  colors: ThemeColors;
  /** Formas y border radii */
  shapes: ThemeShapes;
  /** Transparencias y efectos de vidrio (glassmorphism) */
  glass: ThemeGlass;
  /** Sombras y elevaciones adaptadas al modo activo */
  shadows: ThemeShadows;
  /** Espaciados y márgenes */
  spacing: ThemeSpacing;
  /** Estilos tipográficos */
  typography: ThemeTypography;
  /** Configuración de resortes y animaciones */
  motion: ThemeMotion;
  /** Indica si está en modo oscuro */
  isDark: boolean;
  /** Modo actual */
  mode: ThemeMode;
  /** Alterna entre dark y light */
  toggleTheme: () => void;
  /** Establece el modo explícitamente */
  setMode: (mode: ThemeMode) => void;
}
