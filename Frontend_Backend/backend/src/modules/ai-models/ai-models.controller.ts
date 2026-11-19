import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AiModelsService } from './ai-models.service';
import { CreateAiModelDto, UpdateAiModelDto } from './ai-models.dto';

@ApiTags('Administración - Modelos de IA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/admin/ai-models')
export class AiModelsController {
  constructor(private readonly service: AiModelsService) {}

  @Get()
  @Roles('admin', 'manager')
  list(@Query('environment') environment?: string) {
    return this.service.list(environment);
  }

  @Get('active')
  @Roles('admin', 'manager')
  active() {
    return this.service.active();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateAiModelDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id);
  }

  @Post('sync')
  @Roles('admin')
  sync(@CurrentUser() user: User) {
    return this.service.syncFromService(user.id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAiModelDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user.id);
  }

  /** CP-032-04 */
  @Post(':id/artifact')
  @Roles('admin')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }))
  uploadArtifact(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    return this.service.uploadArtifact(id, file, user.id);
  }

  @Post(':id/check')
  @Roles('admin', 'manager')
  check(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.check(id);
  }

  @Post(':id/activate')
  @Roles('admin')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.activate(id, user.id);
  }

  @Post(':id/deactivate')
  @Roles('admin')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.deactivate(id, user.id);
  }
}
