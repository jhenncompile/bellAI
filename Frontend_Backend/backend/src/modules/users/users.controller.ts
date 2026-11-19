import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Patch,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService, CreateUserDto } from './users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Get()
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAllAdmin(query);
  }

  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOneForAdmin(id);
  }

  @Roles('admin')
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.create(createUserDto, user.id);
  }

  @Roles('admin')
  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.updateStatus(id, dto.status, user.id);
  }

  @Roles('admin')
  @Patch(':id/role')
  async updateRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.updateRole(id, dto.role, user.id);
  }

  @Roles('admin')
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.usersService.delete(id, user.id);
  }
}
