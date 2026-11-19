export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  // Alias de nombres de tokens DS-03
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export type SpacingKey = keyof typeof spacing;

export const componentSizes = {
  button: 52,
  buttonHero: 56,
  buttonSmall: 44,
  input: 52,
  chip: 44,
  touchMin: 44,
  listRow: 62,
  // Barra de pestañas flotante del rediseño
  tabBar: 68,
  tabBarMarginSide: 12,
  tabBarMarginBottom: 14,
  tabBubble: 48, // Sistema P1: burbuja discreta (antes 58)
  tabBubbleLift: 12, // sobresale 12 px de la barra (antes 27)
  /** Margen que el contenido desplazable deja bajo la barra flotante (68 + 14 + 24 de aire; sin área segura). */
  tabBarClearance: 106,
  /** Alto que ocupa la barra flotante sobre el borde inferior (68 + 14 + 8 de aire; sin área segura). */
  tabBarFootprint: 90,
  switchWidth: 52,
  switchHeight: 30,
  switchThumb: 24,
  checkbox: 26,
  avatarSm: 64,
  avatarLg: 72,
  icon: 22,
  iconSm: 18,
  iconLg: 28,
  iconStroke: 2,
  screenWidth: 390,
  screenHeight: 844,
  screenMargin: 20,
  /** Ancho máximo de la columna de contenido (ver `responsive.ts`). */
  contentMaxWidth: 520,
} as const;

export const layoutSpacing = {
  screen: {
    horizontal: componentSizes.screenMargin,
    vertical: spacing.xl,
  },
  card: {
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
  },
  gutter: spacing.md,
} as const;

export interface ThemeSpacing {
  scale: typeof spacing;
  layout: typeof layoutSpacing;
  components: typeof componentSizes;
}

export const themeSpacing: ThemeSpacing = {
  scale: spacing,
  layout: layoutSpacing,
  components: componentSizes,
};
