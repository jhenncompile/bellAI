import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OUTFIT_RATINGS, OutfitRating } from './outfit-ratings';

const RATING_MESSAGE = 'La valoración debe ser agradable, neutral o no agradable.';

export class OutfitContextDto {
  @IsOptional() @IsString() @MaxLength(60)
  occasion?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  latitude?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  longitude?: number;

  /** Temperatura indicada manualmente (si no se envía ubicación). */
  @IsOptional() @IsNumber() @Min(-40) @Max(55)
  temperatureC?: number;

  @IsOptional() @IsBoolean()
  rainy?: boolean;

  /** Sobrescribe el presupuesto del perfil solo para esta consulta. */
  @IsOptional() @IsNumber() @Min(0)
  budgetPerGarment?: number;
}

export class GenerateOutfitsDto extends OutfitContextDto {
  @IsOptional() @IsInt() @Min(1) @Max(6)
  count?: number;
}

export class OutfitItemsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @IsUUID('all', { each: true })
  itemIds: string[];

  @IsOptional() @IsString() @MaxLength(120)
  title?: string;
}

export class CompareOutfitsDto extends OutfitContextDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => OutfitItemsDto)
  outfits: OutfitItemsDto[];
}

export class SaveOutfitDto extends OutfitItemsDto {
  @IsOptional() @IsString() @MaxLength(60)
  occasion?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  explanation?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  score?: number;

  @IsOptional() @IsString() @MaxLength(120)
  weatherSummary?: string;

  @IsOptional() @IsNumber()
  temperatureC?: number;

  @IsOptional() @IsObject()
  details?: Record<string, unknown>;

  @IsOptional() @IsBoolean()
  favorite?: boolean;

  /** HU-22: valoración al guardar */
  @IsOptional() @IsIn(OUTFIT_RATINGS, { message: RATING_MESSAGE })
  rating?: OutfitRating;
}

export class UpdateOutfitDto {
  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @IsOptional() @IsBoolean()
  favorite?: boolean;

  /** HU-22: agradable, neutral o no agradable; `null` quita la valoración */
  @IsOptional() @IsIn([...OUTFIT_RATINGS, null], { message: RATING_MESSAGE })
  rating?: OutfitRating | null;
}
