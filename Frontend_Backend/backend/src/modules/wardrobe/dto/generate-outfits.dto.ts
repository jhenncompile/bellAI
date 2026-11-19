import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { WARDROBE_SEASONS, type WardrobeSeason } from '../entities/wardrobe-item.entity';

export const OUTFIT_OCCASIONS = [
  'todas',
  'trabajo',
  'universidad',
  'evento',
  'diario',
  'deporte',
] as const;
export type OutfitOccasion = (typeof OUTFIT_OCCASIONS)[number];

export const OUTFIT_WEATHER_CONDITIONS = [
  'frio',
  'templado',
  'calido',
  'lluvia',
] as const;
export type OutfitWeatherCondition = (typeof OUTFIT_WEATHER_CONDITIONS)[number];

function transformToStringArray(value: any): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return undefined;
}

/**
 * HU-19 / HU-20 / HU-23: Parámetros para generar combinaciones con las prendas del armario,
 * filtradas por ocasión y clima del día (HU-20) y ajustadas por valoraciones (HU-23).
 */
export class GenerateOutfitsDto {
  /** Limita las combinaciones a prendas compatibles con esta temporada. */
  @IsOptional()
  @IsIn(WARDROBE_SEASONS, { message: 'Temporada no válida' })
  season?: WardrobeSeason;

  /** Número máximo de combinaciones (1 a 20, por defecto 6). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  /** HU-20: Ocasión seleccionada para el conjunto (trabajo, universidad, evento, diario, deporte). */
  @IsOptional()
  @IsIn(OUTFIT_OCCASIONS, { message: 'Ocasión no válida' })
  occasion?: OutfitOccasion;

  /** HU-20: Condición climática del día (frío, templado, cálido, lluvia). Opcional. */
  @IsOptional()
  @IsIn(OUTFIT_WEATHER_CONDITIONS, { message: 'Condición climática no válida' })
  weatherCondition?: OutfitWeatherCondition;

  /** HU-20: Temperatura actual en grados Celsius si está disponible. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La temperatura debe ser un número' })
  temperature?: number;

  /** HU-23: Identificadores de prendas valoradas positivamente para priorizarlas. */
  @IsOptional()
  @Transform(({ value }) => transformToStringArray(value))
  @IsArray()
  @IsString({ each: true })
  likedGarmentIds?: string[];

  /** HU-23: Identificadores de prendas valoradas negativamente para reducir su frecuencia. */
  @IsOptional()
  @Transform(({ value }) => transformToStringArray(value))
  @IsArray()
  @IsString({ each: true })
  dislikedGarmentIds?: string[];

  /** HU-23: Colores o códigos HEX valorados positivamente. */
  @IsOptional()
  @Transform(({ value }) => transformToStringArray(value))
  @IsArray()
  @IsString({ each: true })
  likedColors?: string[];

  /** HU-23: Colores o códigos HEX valorados negativamente. */
  @IsOptional()
  @Transform(({ value }) => transformToStringArray(value))
  @IsArray()
  @IsString({ each: true })
  dislikedColors?: string[];
}
