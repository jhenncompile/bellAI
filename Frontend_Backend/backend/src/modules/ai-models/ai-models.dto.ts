import { IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateAiModelDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{2,80}$/, { message: 'El nombre solo admite minúsculas, números, guiones y guion bajo.' })
  name: string;

  @IsString()
  @MaxLength(40)
  task: string;

  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,40}$/, { message: 'La versión no es válida (ej. face-geometry-1.0.0).' })
  version: string;

  @IsOptional()
  @IsIn(['desarrollo', 'pruebas', 'produccion'])
  environment?: 'desarrollo' | 'pruebas' | 'produccion';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  artifactId?: string;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;
}

export class UpdateAiModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  artifactId?: string;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;
}
