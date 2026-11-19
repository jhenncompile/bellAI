import { Dimensions } from 'react-native';

/** Ancho del lienzo de diseño. Las medidas del rediseño están pensadas para 390 de ancho. */
export const DESIGN_WIDTH = 390;

/** Ancho máximo de la columna de contenido. En pantallas anchas (web, tabletas) la interfaz no se estira. */
export const CONTENT_MAX_WIDTH = 520;

/** Límites de la escala: no se reduce por debajo de 0,82 ni se amplía por encima de 1. */
const MIN_SCALE = 0.82;
const MAX_SCALE = 1;

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

/** Ancho efectivo de la columna de contenido en este dispositivo. */
export const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);

/** Factor horizontal respecto al lienzo de 390. */
export const widthScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, contentWidth / DESIGN_WIDTH));

/** Factor vertical respecto al alto de 844, para composiciones que dependen de la altura. */
export const heightScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, windowHeight / 844));

/**
 * Escala un tamaño de diseño según el ancho de pantalla (títulos, cifras, ilustraciones).
 * No usar para texto de lectura pequeño: ese se deja en su tamaño para respetar la accesibilidad.
 */
export const ms = (size: number): number => Math.round(size * widthScale * 10) / 10;

/** Como `ms`, pero usando el menor de los dos factores. Para piezas que deben caber en alto y ancho. */
export const msFit = (size: number): number =>
  Math.round(size * Math.min(widthScale, heightScale) * 10) / 10;
