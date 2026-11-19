import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminModule } from '../admin/admin.module';
import { BellaiModule } from '../bellai/bellai.module';
import { StorageModule } from '../storage/storage.module';
import { SimulationsService } from './simulations.service';
import { AvatarService } from './avatar.service';
import { AvatarScanService, MAX_TURN_FRAMES } from './avatar-scan.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@ApiTags('Simulación y probador virtual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/simulations')
export class SimulationsController {
  constructor(private readonly service: SimulationsService) {}

  @Get('options')
  options(@CurrentUser() user: User) {
    return this.service.options(user);
  }

  /** Inicia la simulación; responde 202 con la tarea (consultar /api/tasks/:id). */
  @Post()
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  start(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File, @Body('kind') kind: string, @Body('options') options?: string) {
    return this.service.start(user, file, kind, options);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.service.list(user);
  }

  @Get(':id/image')
  async image(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('which') which: string, @Res() res: Response) {
    const img = await this.service.image(user, id, which === 'original' ? 'original' : 'result');
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(img.buffer);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}

@ApiTags('Avatar 3D')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/avatar')
export class AvatarController {
  constructor(private readonly service: AvatarService, private readonly scans: AvatarScanService) {}

  /**
   * HU-023: escaneo guiado. Multipart con face_frente (obligatoria), face_izquierda, face_derecha,
   * face_arriba, face_abajo, tpose (obligatoria), turn_0 … turn_23 y height_cm. Responde 202 con la tarea.
   */
  @Post('scan')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AnyFilesInterceptor({ storage: memoryStorage(), limits: { files: 5 + 1 + MAX_TURN_FRAMES, fileSize: 8 * 1024 * 1024 } }))
  scan(@CurrentUser() user: User, @UploadedFiles() files: Express.Multer.File[], @Body('height_cm') heightCm: string) {
    return this.scans.start(user, files, heightCm);
  }

  /** Comprobación rápida (síncrona) de la foto de cuerpo entero durante el escaneo. No se guarda. */
  @Post('scan/check')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  checkScan(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    return this.scans.checkBody(user, file);
  }

  /** Malla 3D del último escaneo (JSON en metros). */
  @Get('mesh')
  async mesh(@CurrentUser() user: User, @Query('garments') garments: string, @Res() res: Response) {
    // ?garments=tipo:RRGGBB,tipo:RRGGBB (prendas del outfit; sin ellas, el maniquí lleva la ropa genérica)
    const items = String(garments || '')
      .split(',')
      .map((s) => s.trim().split(':'))
      .filter(([kind, hex]) => /^[a-z_]{2,20}$/.test(kind || '') && /^[0-9A-Fa-f]{6}$/.test(hex || ''))
      .slice(0, 6)
      .map(([kind, hex]) => ({ kind, color: `#${hex}` }));
    const json = await this.scans.mesh(user, items);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(json);
  }

  @Delete('scan')
  removeScan(@CurrentUser() user: User) {
    return this.scans.remove(user);
  }

  /** HU-023: configuración del avatar procedural según las proporciones de la usuaria. */
  @Get()
  get(@CurrentUser() user: User) {
    return this.service.get(user);
  }

  @Post()
  save(@CurrentUser() user: User, @Body('customization') customization: Record<string, unknown>) {
    return this.service.save(user, customization || {});
  }

  /** HU-022: prendas de un outfit preparadas para vestir el avatar. */
  @Get('outfit/:outfitId')
  outfit(@CurrentUser() user: User, @Param('outfitId', ParseUUIDPipe) outfitId: string) {
    return this.service.dress(user, outfitId);
  }
}

@Module({
  imports: [AdminModule, BellaiModule, StorageModule, SubscriptionsModule],
  controllers: [SimulationsController, AvatarController],
  providers: [SimulationsService, AvatarService, AvatarScanService],
})
export class SimulationsModule {}
