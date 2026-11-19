export const durations = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  // Rediseño
  rise: 750,
  sheet: 700,
  bubble: 800,
  ripple: 450, // Sistema P1: onda más corta y discreta
  float: 6000,
  drift: 14000,
} as const;

/** Retardo entre bloques que entran escalonados en una pantalla. */
export const staggerStep = 80;

/** Curvas del rediseño como puntos de Bezier cúbica para `Easing.bezier`. */
export const easings = {
  out: [0.2, 0.9, 0.2, 1],
  bounce: [0.3, 1.7, 0.5, 1],
} as const;

export const springs = {
  snappy: {
    speed: 50,
    bounciness: 4,
  },
  gentle: {
    speed: 20,
    bounciness: 2,
  },
  bouncy: {
    speed: 40,
    bounciness: 8,
  },
} as const;

export const scales = {
  pressedButton: 0.96,
  pressedCard: 0.985,
  pressedIconButton: 0.92,
  pressedTile: 0.97,
  /** Icono de la pestaña activa sobre la burbuja. */
  activeTabIcon: 1.12,
  default: 1,
} as const;

export interface ThemeMotion {
  durations: typeof durations;
  springs: typeof springs;
  scales: typeof scales;
  easings: typeof easings;
  staggerStep: number;
}

export const motion: ThemeMotion = {
  durations,
  springs,
  scales,
  easings,
  staggerStep,
};
