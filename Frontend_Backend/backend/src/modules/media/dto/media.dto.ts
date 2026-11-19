import { IsString, IsOptional, IsIn, IsArray, IsBoolean } from 'class-validator';

export class UploadMediaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['photo', 'garment', 'model_3d', 'ai_component', 'texture'])
  mediaType?: 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture';

  @IsOptional()
  @IsIn([
    'catalogo_prendas',
    'probador_virtual_3d',
    'motor_inferencia_ia',
    'perfil_usuario',
    'galeria_marketing',
    'general',
  ])
  systemFunction?:
    | 'catalogo_prendas'
    | 'probador_virtual_3d'
    | 'motor_inferencia_ia'
    | 'perfil_usuario'
    | 'galeria_marketing'
    | 'general';

  @IsOptional()
  @IsString()
  textureType?: string;

  @IsOptional()
  @IsArray()
  usedByComponents?: string[];
}

export class PresignedUploadDto {
  @IsString()
  filename: string;

  @IsString()
  contentType: string;

  @IsIn(['photo', 'garment', 'model_3d', 'ai_component', 'texture'])
  mediaType: 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture';

  @IsOptional()
  @IsIn([
    'catalogo_prendas',
    'probador_virtual_3d',
    'motor_inferencia_ia',
    'perfil_usuario',
    'galeria_marketing',
    'general',
  ])
  systemFunction?:
    | 'catalogo_prendas'
    | 'probador_virtual_3d'
    | 'motor_inferencia_ia'
    | 'perfil_usuario'
    | 'galeria_marketing'
    | 'general';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  textureType?: string;

  @IsOptional()
  @IsArray()
  usedByComponents?: string[];
}

export class ConfirmUploadDto {
  @IsString()
  key: string;

  @IsString()
  originalFilename: string;

  @IsString()
  title: string;

  @IsIn(['photo', 'garment', 'model_3d', 'ai_component', 'texture'])
  mediaType: 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture';

  @IsOptional()
  @IsIn([
    'catalogo_prendas',
    'probador_virtual_3d',
    'motor_inferencia_ia',
    'perfil_usuario',
    'galeria_marketing',
    'general',
  ])
  systemFunction?:
    | 'catalogo_prendas'
    | 'probador_virtual_3d'
    | 'motor_inferencia_ia'
    | 'perfil_usuario'
    | 'galeria_marketing'
    | 'general';

  @IsString()
  mimeType: string;

  @IsOptional()
  sizeBytes?: number;

  @IsOptional()
  textureType?: string;

  @IsOptional()
  @IsArray()
  usedByComponents?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class DeleteMediaDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
