import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsBooleanString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_SUBCATEGORIES,
  WARDROBE_SEASONS,
  WARDROBE_OCCASIONS,
  WARDROBE_CAPTURE_SOURCES,
  type WardrobeCategory,
  type WardrobeSubcategory,
  type WardrobeSeason,
  type WardrobeOccasion,
  type WardrobeCaptureSource,
} from '../entities/wardrobe-item.entity';

/**
 * DTO para el escaneo inteligente o registro de prenda mediante fotografía
 * tomada desde la cámara o seleccionada de la galería móvil (React Native).
 */
export class ScanGarmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El nombre no puede exceder los 150 caracteres' })
  name?: string;

  @IsOptional()
  @IsIn(WARDROBE_CATEGORIES, {
    message: 'La categoría debe ser superior, inferior, calzado, abrigo o accesorio',
  })
  category?: WardrobeCategory;

  @IsOptional()
  @IsIn(WARDROBE_SUBCATEGORIES, {
    message: 'La subcategoría proporcionada no es válida',
  })
  subcategory?: WardrobeSubcategory;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;

  /**
   * HU-15: color confirmado o corregido por la usuaria en el móvil (#RRGGBB).
   * Si llega, prevalece sobre el color que detecte el servidor.
   */
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB' })
  colorHex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  approximateSize?: string;

  @IsOptional()
  @IsIn(WARDROBE_SEASONS, {
    message: 'La temporada debe ser primavera, verano, otono, invierno o todo_el_ano',
  })
  season?: WardrobeSeason;

  @IsOptional()
  @IsIn(WARDROBE_OCCASIONS)
  occasion?: WardrobeOccasion;

  @IsOptional()
  @IsIn(WARDROBE_CAPTURE_SOURCES, {
    message: 'El origen de captura debe ser camera o gallery',
  })
  captureSource?: WardrobeCaptureSource;

  @IsOptional()
  @IsBooleanString()
  autoConfirm?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El identificador de borrador no es un UUID válido' })
  draftId?: string;
}
