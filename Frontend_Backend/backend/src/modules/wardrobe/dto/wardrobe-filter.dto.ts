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
 * DTO para filtrar y organizar las prendas del armario personal de la usuaria.
 */
export class WardrobeFilterDto {
  @IsOptional()
  @IsIn(WARDROBE_CATEGORIES)
  category?: WardrobeCategory;

  @IsOptional()
  @IsIn(WARDROBE_SUBCATEGORIES)
  subcategory?: WardrobeSubcategory;

  @IsOptional()
  @IsIn(WARDROBE_SEASONS)
  season?: WardrobeSeason;

  @IsOptional()
  @IsIn(WARDROBE_OCCASIONS)
  occasion?: WardrobeOccasion;

  @IsOptional()
  @IsIn(WARDROBE_STATUSES)
  status?: WardrobeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
