import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { AvatarPreset } from '../api/types';

/** Anchos relativos de hombros, cintura y cadera de cada silueta base (0–1 sobre la mitad del icono). */
const SHAPES: Record<AvatarPreset, { shoulder: number; waist: number; hip: number }> = {
  rectangulo: { shoulder: 0.62, waist: 0.56, hip: 0.6 },
  pera: { shoulder: 0.5, waist: 0.42, hip: 0.8 },
  reloj: { shoulder: 0.68, waist: 0.34, hip: 0.68 },
  triangulo_invertido: { shoulder: 0.82, waist: 0.48, hip: 0.5 },
  redondo: { shoulder: 0.6, waist: 0.8, hip: 0.66 },
};

/** HU-023: icono simple de la silueta base (sin vista previa 3D). */
export function BodyShapeIcon({ preset, size = 40, color }: { preset: AvatarPreset; size?: number; color: string }) {
  const { shoulder, waist, hip } = SHAPES[preset];
  const cx = 20;
  const w = (f: number) => 14 * f; // media anchura en un lienzo de 40
  const d = [
    `M ${cx - w(shoulder)} 13`,
    `Q ${cx - w((shoulder + waist) / 2) - 1} 19 ${cx - w(waist)} 23`,
    `Q ${cx - w((waist + hip) / 2) - 1} 27 ${cx - w(hip)} 31`,
    `L ${cx - w(hip) * 0.5} 39`,
    `L ${cx + w(hip) * 0.5} 39`,
    `L ${cx + w(hip)} 31`,
    `Q ${cx + w((waist + hip) / 2) + 1} 27 ${cx + w(waist)} 23`,
    `Q ${cx + w((shoulder + waist) / 2) + 1} 19 ${cx + w(shoulder)} 13`,
    'Z',
  ].join(' ');
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={cx} cy={6.5} r={4.2} fill={color} />
      <Path d={d} fill={color} />
    </Svg>
  );
}

export const PRESET_LABELS: Record<AvatarPreset, string> = {
  rectangulo: 'Rectángulo',
  pera: 'Pera',
  reloj: 'Reloj de arena',
  triangulo_invertido: 'Triángulo invertido',
  redondo: 'Redondo',
};
