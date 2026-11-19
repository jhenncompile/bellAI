export type GarmentCategory =
  | 'Superior'
  | 'Inferior'
  | 'Calzado'
  | 'Accesorio'
  | 'Abrigo';

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  primaryColorHex: string;
  colorName: string;
  seasonMatch: 'Armonia Total' | 'Aceptable' | 'No Favorece';
  compatibilityScore: number; // 0 a 100
  imageUri?: string;
  tips: string;
}
