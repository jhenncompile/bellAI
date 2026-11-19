import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, IsDateString } from 'class-validator';

export class UpdateProfileDto {
  // CP-001-02: si se envía, el nombre no puede quedar vacío
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
