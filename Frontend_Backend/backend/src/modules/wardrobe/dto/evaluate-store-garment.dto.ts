import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_OCCASIONS,
  WARDROBE_SEASONS,
  type WardrobeCategory,
  type WardrobeOccasion,
  type WardrobeSeason,
  type WardrobeSubcategory,
} from '../entities/wardrobe-item.entity';

/**
 * HU-24: DTO para evaluar si una prenda en tienda es compatible con el perfil
 * (colorimetría/estación) y el armario de la usuaria.
 */
export class EvaluateStoreGarmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsNotEmpty({ message: 'La categoría de la prenda es obligatoria' })
  @IsEnum(WARDROBE_CATEGORIES, {
    message: `Categoría inválida. Debe ser una de: ${WARDROBE_CATEGORIES.join(', ')}`,
  })
  category: WardrobeCategory;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  subcategory?: WardrobeSubcategory;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  colorHex?: string;

  @IsOptional()
  @IsEnum(WARDROBE_OCCASIONS, {
    message: `Ocasión inválida. Debe ser una de: ${WARDROBE_OCCASIONS.join(', ')}`,
  })
  occasion?: WardrobeOccasion;

  @IsOptional()
  @IsEnum(WARDROBE_SEASONS, {
    message: `Temporada inválida. Debe ser una de: ${WARDROBE_SEASONS.join(', ')}`,
  })
  season?: WardrobeSeason;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  storeName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio debe ser un número válido' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price?: number;
}

