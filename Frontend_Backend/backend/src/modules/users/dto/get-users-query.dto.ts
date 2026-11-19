import { IsOptional, IsString } from 'class-validator';

export class GetUsersQueryDto {
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser texto' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'El filtro de rol debe ser texto' })
  role?: string;

  @IsOptional()
  @IsString({ message: 'El filtro de estado debe ser texto' })
  status?: string;
}

