import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @IsOptional()
  @IsIn(['admin', 'manager', 'user'], { message: 'El rol debe ser admin, manager o user' })
  role?: 'admin' | 'manager' | 'user';

  @IsOptional()
  @IsIn(['active', 'inactive', 'suspended'], { message: 'El estado debe ser active, inactive o suspended' })
  status?: 'active' | 'inactive' | 'suspended';

  @IsOptional()
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  password?: string;
}

