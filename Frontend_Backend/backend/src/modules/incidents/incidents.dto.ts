import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export const INCIDENT_TYPES = ['error', 'analisis', 'armario', 'cuenta', 'privacidad', 'sugerencia', 'otro'] as const;
export const INCIDENT_STATUS = ['abierta', 'en_proceso', 'resuelta', 'cerrada'] as const;
export const INCIDENT_PRIORITY = ['baja', 'media', 'alta'] as const;

export class CreateIncidentDto {
  @IsIn(INCIDENT_TYPES as unknown as string[], { message: 'Tipo de incidencia no válido.' })
  type: string;

  @IsString()
  @MinLength(4, { message: 'Describe el problema en un título de al menos 4 caracteres.' })
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(10, { message: 'Cuéntanos un poco más (mínimo 10 caracteres).' })
  @MaxLength(4000)
  description: string;

  /** Datos técnicos opcionales: pantalla, versión de la app, id de tarea fallida… */
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsIn(INCIDENT_STATUS as unknown as string[])
  status?: string;

  @IsOptional()
  @IsIn(INCIDENT_PRIORITY as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  response?: string;
}

export class ListIncidentsQuery {
  @IsOptional() @IsIn(INCIDENT_STATUS as unknown as string[]) status?: string;
  @IsOptional() @IsIn(INCIDENT_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsIn(INCIDENT_PRIORITY as unknown as string[]) priority?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
