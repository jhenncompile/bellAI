/**
 * Modelos de datos para el dominio de Armario Digital y Recursos Multimedia
 */

export type GarmentCategory =
  | 'Superior'
  | 'Inferior'
  | 'Calzado'
  | 'Accesorio'
  | 'Abrigo';

export interface GarmentItem {
  id: string;
  name: string;
  category: string;
  color: string;
  occasion?: string;
  timesWorn?: number;
  imageUrl?: string;
}

export interface MediaAssetDto {
  id: string;
  userId?: string;
  title: string;
  originalFilename: string;
  s3Url: string;
  cdnUrl: string;
  mediaType: 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture' | 'avatar';
  systemFunction:
    | 'catalogo_prendas'
    | 'probador_virtual_3d'
    | 'motor_inferencia_ia'
    | 'perfil_usuario'
    | 'galeria_marketing'
    | 'general';
  isActive: boolean;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface CreateGarmentDto {
  title: string;
  fileUri: string;
  category: string;
  color: string;
  metadata?: Record<string, any>;
}
