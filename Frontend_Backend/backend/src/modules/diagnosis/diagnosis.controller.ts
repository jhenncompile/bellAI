import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DiagnosisService } from './diagnosis.service';

const upload = { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } };

@ApiTags('Diagnóstico morfológico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/diagnosis')
export class DiagnosisController {
  constructor(private readonly service: DiagnosisService) {}

  /** HU-035: validar la foto antes del análisis. */
  @Post('validate')
  @ApiConsumes('multipart/form-data')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', upload))
  validate(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File, @Body('type') type = 'rostro') {
    return this.service.validate(user, file, type);
  }

  /** Inicia el diagnóstico integral (rostro y/o cuerpo). Devuelve la tarea para consultar su estado. */
  @Post()
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'face', maxCount: 1 }, { name: 'body', maxCount: 1 }], upload))
  start(@CurrentUser() user: User, @UploadedFiles() files: { face?: Express.Multer.File[]; body?: Express.Multer.File[] }) {
    return this.service.start(user, files?.face?.[0], files?.body?.[0]);
  }

  @Get('latest')
  latest(@CurrentUser() user: User) {
    return this.service.latest(user);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.service.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}

/** Ruta que ya usa la app móvil (`/api/vision/analyze-face`). */
@ApiTags('Diagnóstico morfológico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/vision')
export class VisionCompatController {
  constructor(private readonly service: DiagnosisService) {}

  @Post('analyze-face')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', upload))
  analyzeFace(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    return this.service.analyzeFaceSync(user, file);
  }
}
