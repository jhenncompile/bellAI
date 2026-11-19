import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { StorageMonitorService } from './storage-monitor.service';
import { UploadMediaDto, PresignedUploadDto, ConfirmUploadDto } from './dto/media.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../storage/storage.service';
import { Request } from 'express';

/** Roles con permiso para supervisar todos los recursos multimedia (HU-033). */
function isStaff(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'manager';
}

@Controller('api/media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storageService: StorageService,
    private readonly monitor: StorageMonitorService,
  ) {}

  /**
   * Subida de recursos multimedia y modelos
   * Regla HU-033: Solo personal autorizado (admin / manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 250 * 1024 * 1024, // 250MB para modelos de IA y 3D
      },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debes proporcionar un archivo en el campo "file"');
    }
    return await this.mediaService.processAndUploadMedia(file, dto, user?.id);
  }

  /**
   * Genera URL prefirmada para subida directa a S3 (Direct-to-S3 Upload)
   * Regla HU-033: Solo personal autorizado (admin / manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('presigned-upload')
  async createPresignedUpload(@Body() dto: PresignedUploadDto, @CurrentUser() user: any) {
    return await this.mediaService.createPresignedUpload(dto, user?.id);
  }

  /**
   * Confirma la subida directa a S3 y registra el recurso
   * Regla HU-033: Solo personal autorizado (admin / manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('confirm-upload')
  async confirmPresignedUpload(@Body() dto: ConfirmUploadDto, @CurrentUser() user: any) {
    return await this.mediaService.confirmPresignedUpload(dto, user?.id);
  }

  /**
   * Endpoint de soporte para subida directa simulada en entorno de desarrollo local sin S3
   */
  @Put('direct-upload-simulated')
  async directUploadSimulated(@Query('key') key: string, @Req() req: Request) {
    if (!key) throw new BadRequestException('Falta parámetro key');
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        const res = await this.storageService.uploadFile({
          key,
          buffer,
          contentType: contentType as string,
        });
        resolve(res);
      });
      req.on('error', reject);
    });
  }

  /**
   * Lista recursos organizados según su tipo y función (HU-033)
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async listMedia(
    @CurrentUser() user: any,
    @Query('type') type?: any,
    @Query('functionTag') functionTag?: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 50;
    // El personal (admin/manager) supervisa todo el catálogo; una usuaria normal
    // (por ejemplo desde la app móvil) sólo ve sus propios recursos.
    const ownerId = isStaff(user) ? undefined : user?.id;
    return await this.mediaService.listMedia(type, functionTag, search, p, l, ownerId);
  }

  /**
   * Estadísticas de supervisión de recursos, almacenamiento y dependencias
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('stats/overview')
  async getStorageStats() {
    const [stats, usage] = await Promise.all([this.mediaService.getStorageStats(), this.monitor.usage()]);
    return { ...stats, usage };
  }

  /** CP-033-04: limpieza de archivos huérfanos (dryRun=true solo lista). */
  @Post('cleanup-orphans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async cleanupOrphans(@Query('dryRun') dryRun: string, @CurrentUser() user: any) {
    return this.monitor.cleanupOrphans(dryRun !== 'false', user.id);
  }

  /**
   * Verifica las dependencias de un recurso antes de retirar o eliminar (Regla HU-033)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get(':id/dependencies')
  async verifyDependencies(@Param('id') id: string) {
    return await this.mediaService.verifyDependencies(id);
  }

  /**
   * Detalle de un recurso multimedia o modelo por ID
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getMediaById(@Param('id') id: string, @CurrentUser() user: any) {
    const asset = await this.mediaService.getMediaById(id);
    if (!isStaff(user) && asset.userId !== user?.id) {
      // Mismo mensaje que un recurso inexistente: no revelamos qué IDs existen.
      throw new NotFoundException('Elemento multimedia no encontrado');
    }
    return asset;
  }

  /**
   * Retira de forma segura un recurso del sistema sin romper componentes
   * Regla HU-033: Solo personal autorizado (admin / manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id/retire')
  async retireMedia(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.mediaService.retireMedia(id, user);
  }

  /**
   * Elimina un recurso del sistema con verificación estricta de dependencias activas
   * Regla HU-033: Solo personal autorizado (admin / manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  async deleteMedia(
    @Param('id') id: string,
    @Query('force') force: string,
    @CurrentUser() user: any,
  ) {
    const isForced = force === 'true';
    return await this.mediaService.deleteMedia(id, isForced, user);
  }
}
