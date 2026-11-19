import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TasksService } from './tasks.service';

@ApiTags('Tareas asíncronas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('type') type?: string, @Query('limit') limit?: string) {
    return this.tasks.list(user.id, type, limit ? Number(limit) : 20);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  stats() {
    return this.tasks.stats();
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(id, user.id);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.retry(id, user.id);
  }
}
