import { ArrayMaxSize, IsArray, IsIn, IsUUID, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FeedbackAttributesDto {
  /** Estilos del elemento valorado (p. ej. ['Minimalista', 'Clásico']). */
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(60, { each: true })
  styles?: string[];

  /** Dimensión del Style DNA asociada (p. ej. 'elegancia'). */
  @IsOptional() @IsString() @MaxLength(30)
  dimension?: string;

  /** Vector parcial de dimensiones (0-100). */
  @IsOptional() @IsObject()
  dna?: Record<string, number>;

  @IsOptional() @IsString() @MaxLength(40)
  recommendationType?: string;

  /** HU-23: prendas de la combinación valorada (si no está guardada), para aprender de ellas. */
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsUUID('all', { each: true, message: 'Alguna prenda de la combinación no es válida.' })
  itemIds?: string[];
}

export class FeedbackDto {
  @IsIn(['recomendacion', 'outfit', 'prenda', 'simulacion', 'color', 'estilo', 'compatibilidad'])
  targetType: string;

  @IsString()
  @MaxLength(120)
  targetId: string;

  @IsIn(['me_gusta', 'neutral', 'no_me_gusta'], { message: 'La valoración debe ser me_gusta, neutral o no_me_gusta.' })
  value: 'me_gusta' | 'neutral' | 'no_me_gusta';

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackAttributesDto)
  attributes?: FeedbackAttributesDto;
}
