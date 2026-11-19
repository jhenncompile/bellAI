import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    return normalized === '' ? undefined : normalized;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'all' || value === '' ? undefined : value))
  @IsIn(['admin', 'manager', 'user'])
  role?: 'admin' | 'manager' | 'user';

  @IsOptional()
  @Transform(({ value }) => (value === 'all' || value === '' ? undefined : value))
  @IsIn(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
