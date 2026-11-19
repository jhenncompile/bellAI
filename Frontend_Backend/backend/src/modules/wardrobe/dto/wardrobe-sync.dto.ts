import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

/**
 * DTO para actualizar los interruptores de disponibilidad en la nube (copia automática)
 * y modo sin conexión (HU-040).
 */
export class UpdateSyncSettingsDto {
  @IsOptional()
  @IsBoolean({ message: 'autoBackupEnabled debe ser un valor booleano' })
  autoBackupEnabled?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'offlineModeEnabled debe ser un valor booleano' })
  offlineModeEnabled?: boolean;
}

/**
 * DTO para registrar cuándo se usó una prenda en el armario (HU-011).
 */
export class RecordWearDto {
  @IsOptional()
  @IsDateString({}, { message: 'wornAt debe ser una fecha ISO 8601 válida' })
  wornAt?: string;
}
