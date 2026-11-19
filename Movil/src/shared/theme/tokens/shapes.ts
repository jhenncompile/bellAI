export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  full: 9999,
  // Alias tokens DS-03
  '2xl': 24,
  '3xl': 28,
  pill: 9999,
  // Rediseño
  field: 18,
  tabBar: 30,
  hero: 32,
} as const;

export type RadiusSize = keyof typeof radius;

export const borderWidths = {
  none: 0,
  thin: 1,
  medium: 1.5,
  thick: 2,
  heavy: 3,
} as const;

export type BorderWidthSize = keyof typeof borderWidths;

export const componentShapes = {
  button: {
    sm: radius.lg, // 16
    md: radius.lg, // 16
    lg: radius.xl, // 20
    pill: radius.full,
  },
  card: {
    sm: radius.lg, // 16
    md: radius.xxl, // 24 - radio estándar de tarjeta del rediseño
    lg: radius.xxl, // 24 - contenedor amplio
    rounded: radius.xxxl, // 28
    hero: radius.hero, // 32 - tarjeta de resultado
  },
  /** Hoja inferior: solo esquinas superiores. */
  sheet: radius.hero,
  /** Diálogo centrado. */
  dialog: radius.xxxl,
  input: {
    sm: radius.md,
    md: radius.field, // 18
    lg: radius.field,
    pill: radius.full,
  },
  chip: {
    pill: radius.full,
    rounded: radius.lg,
  },
  badge: {
    pill: radius.full,
    rounded: radius.sm,
  },
  avatar: {
    circle: radius.full,
    squircle: radius.lg,
  },
  /** Arco: esquinas superiores totalmente redondeadas y las inferiores pequeñas. */
  arch: {
    top: 999,
    bottom: 18,
    bottomLarge: 28,
    bottomSmall: 14,
  },
  tabBar: radius.tabBar,
  checkbox: radius.sm,
  brandMark: 14,
} as const;

export interface ThemeShapes {
  radius: typeof radius;
  borderWidths: typeof borderWidths;
  components: typeof componentShapes;
}

export const shapes: ThemeShapes = {
  radius,
  borderWidths,
  components: componentShapes,
};
