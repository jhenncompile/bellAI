import { IsIn, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(['admin', 'manager', 'user'])
  role: 'admin' | 'manager' | 'user';
}
