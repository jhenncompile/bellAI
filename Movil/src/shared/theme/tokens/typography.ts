import { TextStyle } from 'react-native';
import { ms } from './responsive';

/**
 * Familias cargadas con `useFonts` (ver `shared/theme/fonts.ts`).
 * Con fuentes personalizadas cada peso es una familia distinta: Android ignora `fontWeight`
 * y iOS podría simular negrita, así que los presets no declaran `fontWeight`.
 */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  display: 'Fraunces_500Medium',
  displaySemibold: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
} as const;

export const fontFamily = fonts.regular;
export const fontFamilyDisplay = fonts.display;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export const fontSizes = {
  caption: 12,
  navLabel: 11, // Sistema P1: mínimo 11 px
  label: 13,
  small: 13,
  hint: 12.5,
  tag: 12.5,
  body: 14.5,
  button: 15,
  h4: 16,
  h3: ms(19),
  h2: ms(24),
  titleBar: ms(26),
  h1: ms(32),
  stat: ms(40),
  display: ms(46),
  // Compatibilidad
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 17,
  score: 46,
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    lineHeight: Math.round(fontSizes.display * 1.03),
    letterSpacing: -0.02 * fontSizes.display,
  } as TextStyle,
  h1: {
    fontFamily: fonts.display,
    fontSize: fontSizes.h1,
    lineHeight: Math.round(fontSizes.h1 * 1.06),
    letterSpacing: -0.02 * fontSizes.h1,
  } as TextStyle,
  /** Título junto al botón de retorno. */
  titleBar: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleBar,
    lineHeight: Math.round(fontSizes.titleBar * 1.08),
    letterSpacing: -0.02 * fontSizes.titleBar,
  } as TextStyle,
  h2: {
    fontFamily: fonts.display,
    fontSize: fontSizes.h2,
    lineHeight: Math.round(fontSizes.h2 * 1.08),
    letterSpacing: -0.02 * fontSizes.h2,
  } as TextStyle,
  h3: {
    fontFamily: fonts.displaySemibold,
    fontSize: fontSizes.h3,
    lineHeight: Math.round(fontSizes.h3 * 1.1),
    letterSpacing: -0.02 * fontSizes.h3,
  } as TextStyle,
  /** Cifras destacadas: puntuación, estación, administración. */
  stat: {
    fontFamily: fonts.display,
    fontSize: fontSizes.stat,
    lineHeight: Math.round(fontSizes.stat * 1.05),
    letterSpacing: -0.02 * fontSizes.stat,
  } as TextStyle,
  /** Palabra de énfasis dentro de un título (cursiva). */
  emphasis: {
    fontFamily: fonts.displayItalic,
  } as TextStyle,
  h4: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.h4,
    lineHeight: 21,
    letterSpacing: 0,
  } as TextStyle,
  button: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.button,
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,
  bodyStrong: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,
  small: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.small,
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,
  smallStrong: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.small,
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,
  /** Texto de ayuda bajo un campo. */
  hint: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.hint,
    lineHeight: 17,
    letterSpacing: 0,
  } as TextStyle,
  /** Etiqueta de campo. */
  label: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.label,
    lineHeight: 17,
    letterSpacing: 0,
  } as TextStyle,
  /** Etiqueta en píldora. */
  tag: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.tag,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,
  /** Etiqueta de sección en mayúsculas (aplicar `textTransform: 'uppercase'` al texto). */
  eyebrow: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.caption,
    lineHeight: 16,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
  } as TextStyle,
  caption: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.caption,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,
  captionStrong: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.caption,
    lineHeight: 16,
    letterSpacing: 0,
  } as TextStyle,
  /** Etiqueta de pestaña; la activa usa `navLabelActive`. */
  navLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.navLabel,
    lineHeight: 14,
    letterSpacing: 0,
  } as TextStyle,
  navLabelActive: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.navLabel,
    lineHeight: 14,
    letterSpacing: 0,
  } as TextStyle,

  // Aliases de compatibilidad
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.h4,
    lineHeight: 22,
  } as TextStyle,
  bodyMedium: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    lineHeight: 22,
  } as TextStyle,
  bodySmall: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.small,
    lineHeight: 18,
  } as TextStyle,
  scoreBig: {
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    lineHeight: Math.round(fontSizes.display * 1.03),
    letterSpacing: -0.02 * fontSizes.display,
  } as TextStyle,
} as const;

export type TypographyPreset = keyof typeof typography;

export interface ThemeTypography {
  presets: typeof typography;
  weights: typeof fontWeights;
  sizes: typeof fontSizes;
}

export const themeTypography: ThemeTypography = {
  presets: typography,
  weights: fontWeights,
  sizes: fontSizes,
};
