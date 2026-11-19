import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, ListIncidentsQuery, UpdateIncidentDto } from './incidents.dto';

@ApiTags('Incidencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/incidents')
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateIncidentDto) {
    return this.service.create(user.id, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: User) {
    return this.service.mine(user.id);
  }
}

@ApiTags('Administración - Incidencias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('api/admin/incidents')
export class AdminIncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  list(@Query() query: ListIncidentsQuery) {
    return this.service.list(query);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIncidentDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user.id);
  }
}
