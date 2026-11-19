import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
 * DTO para conservar un borrador de prenda antes de subir la fotografía
 * o cuando la subida desde la cámara/galería falla en el móvil.
 */
export class CreateDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'El nombre no puede exceder los 150 caracteres' })
  name?: string;

  @IsIn(WARDROBE_CATEGORIES, {
    message:
      'La categoría es obligatoria (superior, inferior, calzado, abrigo o accesorio)',
  })
  category: WardrobeCategory;

  @IsOptional()
  @IsIn(WARDROBE_SUBCATEGORIES, {
    message: 'La subcategoría proporcionada no es válida',
  })
  subcategory?: WardrobeSubcategory;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;

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
}
