import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_SUBCATEGORIES,
  WARDROBE_SEASONS,
  WARDROBE_OCCASIONS,
  WARDROBE_STATUSES,
  type WardrobeCategory,
  type WardrobeSubcategory,
  type WardrobeSeason,
  type WardrobeOccasion,
  type WardrobeStatus,
} from '../entities/wardrobe-item.entity';

/**
 * DTO para editar datos de una prenda del armario o confirmar un borrador.
 */
export class UpdateWardrobeItemDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(7)
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
  @IsIn(WARDROBE_OCCASIONS, {
    message: 'La ocasión debe ser casual, formal, fiesta, deporte, trabajo, playa o gala',
  })
  occasion?: WardrobeOccasion | null;

  @IsOptional()
  @IsIn(WARDROBE_STATUSES, {
    message: 'El estado debe ser draft, processing, confirmed o upload_failed',
  })
  status?: WardrobeStatus;
}
