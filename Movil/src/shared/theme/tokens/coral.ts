/**
 * Propuesta P1 «Coral amanecer» del rediseño (Penpot: «Flujo 01 · Propuestas (rediseño)»).
 * Gradiente coral a durazno, fondo crema, botón principal en tinta y acento de texto ladrillo.
 * Contraste medido (WCAG 2.1) en modo claro, sobre el fondo #FFE8E0:
 *   tinta 14,5:1 · texto secundario 6,8:1 · acento 5,1:1 · texto del botón 17,1:1 ·
 *   texto de ejemplo en los campos 4,6:1 · tinta sobre el coral más intenso del héroe 6,3:1.
 * Por ahora la usan Acceso (bienvenida, inicio de sesión, registro), la bienvenida guiada e Inicio.
 */
export interface CoralTokens {
  /** Fondo de pantalla, vertical de arriba abajo. */
  background: readonly [string, string];
  ink: string;
  ink2: string;
  placeholder: string;
  /** Acento para texto y enlaces. */
  accent: string;
  /** Relleno del botón principal y de las opciones elegidas. */
  primary: string;
  onPrimary: string;
  /** Gradiente de las tarjetas destacadas (héroe). El texto encima es `heroInk`. */
  hero: readonly [string, string, string];
  heroInk: string;
  /** Brillo radial blanco sobre el héroe. */
  heroGlow: string;
  card: string;
  /** Color de la sombra de tarjetas y botones redondos. */
  shadow: string;
  field: string;
  fieldStroke: string;
  /** Superficie neutra para pasos pendientes y casillas. */
  muted: string;
  chip: string;
  /** Gradientes pastel de los iconos de acceso; el icono va en `ink`. */
  tiles: readonly [readonly [string, string], readonly [string, string], readonly [string, string], readonly [string, string]];
  danger: string;
  dangerBg: string;
}

export const coralLight: CoralTokens = {
  background: ['#FFF7F1', '#FFE8E0'],
  ink: '#2A1714',
  ink2: '#664A44',
  placeholder: '#8A6F69',
  accent: '#B3392E',
  primary: '#2A1714',
  onPrimary: '#FFFFFF',
  hero: ['#FF6F61', '#FF9B7B', '#FFD5A1'],
  heroInk: '#2A1714',
  heroGlow: 'rgba(255, 255, 255, 0.55)',
  card: '#FFFFFF',
  shadow: '#B3392E',
  field: '#FFFFFF',
  fieldStroke: '#EBD5CE',
  muted: '#F6E4DE',
  chip: '#FFFFFF',
  tiles: [
    ['#FFC2AE', '#FFE2C6'],
    ['#FFC7C2', '#FFE0D6'],
    ['#FFE1BC', '#FFD0B0'],
    ['#FAD6CF', '#F7C1B6'],
  ],
  danger: '#B42318',
  dangerBg: '#FDE7E4',
};

/** Variante oscura: mismo gradiente coral (texto oscuro encima) y superficies vino oscuro. */
export const coralDark: CoralTokens = {
  background: ['#241619', '#2E1C1F'],
  ink: '#FFF1EC',
  ink2: '#E3C6BE',
  placeholder: '#B9988F',
  accent: '#FF9B85',
  primary: '#FF9B7B',
  onPrimary: '#2A1714',
  hero: ['#FF6F61', '#FF9B7B', '#FFD5A1'],
  heroInk: '#2A1714',
  heroGlow: 'rgba(255, 255, 255, 0.45)',
  card: '#3A262B',
  shadow: '#000000',
  field: '#2E1C1F',
  fieldStroke: '#5A4047',
  muted: '#4A3238',
  chip: '#FFFFFF',
  tiles: coralLight.tiles,
  danger: '#FF9F8A',
  dangerBg: '#4A2620',
};

/** Fuentes de la propuesta: Fraunces en títulos (palabra clave en cursiva) y Nunito en texto. */
export const coralFonts = {
  title: 'Fraunces_600SemiBold',
  titleAccent: 'Fraunces_500Medium_Italic',
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/** Dirección del gradiente del héroe (150° en Penpot). */
export const coralHeroDirection = { start: { x: 0.2, y: 0 }, end: { x: 0.8, y: 1 } } as const;
