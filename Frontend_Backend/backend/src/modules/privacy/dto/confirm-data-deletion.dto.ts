import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmDataDeletionDto {
  @IsBoolean()
  confirm: boolean;

  /** CP-029-03: la eliminación de la cuenta se confirma con la contraseña actual. */
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña para confirmar la eliminación.' })
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
