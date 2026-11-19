import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
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
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

const upload = { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } };

/**
 * Proxy de /api/vision/* hacia el servicio de IA (FastAPI). Cada ruta ejecuta un modelo real:
 * - analyze-garment: ResNet-34 (ImageNet) + CLIP, con la probabilidad del modelo como confianza.
 * - analyze-hair: BiSeNet (ResNet-18) face parsing, que separa cabello de sombrero y gafas.
 * - analyze-outfit: SegFormer-B2 (ATR), prendas que lleva puestas y su color.
 * - analyze-body: MediaPipe Pose Landmarker.
 * - virtual-tryon / virtual-makeup: simulación 2D sobre los puntos de MediaPipe.
 * - match-compatibility: red siamesa ResNet-34 + armonía de color.
 *
 * `POST api/vision/analyze-face` lo atiende VisionCompatController (módulo de diagnóstico), que
 * además guarda el resultado.
 *
 * Antes este controlador tenía respaldos con Sharp que devolvían resultados inventados
 * (confianza 0,95 fija, «VITON-HD», «BeautyGAN») cuando la IA fallaba, y llamaba sin la clave
 * interna, así que con AI_INTERNAL_KEY configurada SIEMPRE caía en esos respaldos. Ahora, si la IA
 * no responde, se devuelve un error 503 claro (AiGatewayService) en lugar de datos falsos.
 */
@ApiTags('Visión por computadora')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/vision')
export class VisionController {
  constructor(private readonly ai: AiGatewayService) {}

  private static required(file: Express.Multer.File | undefined, field: string): Express.Multer.File {
    if (!file) throw new BadRequestException(`Debes enviar una fotografía con el campo "${field}".`);
    return file;
  }

  @Post('analyze-garment')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', upload))
  analyzeGarment(@UploadedFile() file: Express.Multer.File) {
    return this.ai.postImage('/api/v1/vision/analyze-garment', VisionController.required(file, 'file'));
  }

  @Post('analyze-hair')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', upload))
  analyzeHair(@UploadedFile() file: Express.Multer.File) {
    return this.ai.postImage('/api/v1/vision/analyze-hair', VisionController.required(file, 'file'));
  }

  @Post('analyze-outfit')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', upload))
  analyzeOutfit(@UploadedFile() file: Express.Multer.File) {
    return this.ai.postImage('/api/v1/vision/analyze-outfit', VisionController.required(file, 'file'));
  }

  @Post('analyze-body')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', upload))
  analyzeBody(@UploadedFile() file: Express.Multer.File) {
    return this.ai.postImage('/api/v1/vision/analyze-body', VisionController.required(file, 'file'));
  }

  @Post('virtual-tryon')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'person', maxCount: 1 }, { name: 'garment', maxCount: 1 }], upload))
  virtualTryon(
    @UploadedFiles() files: { person?: Express.Multer.File[]; garment?: Express.Multer.File[] },
    @Body('category') category?: string,
  ) {
    const person = VisionController.required(files?.person?.[0], 'person');
    const garment = VisionController.required(files?.garment?.[0], 'garment');
    return this.ai.postFiles('/api/v1/vision/virtual-tryon', { person, garment }, { category: category || 'superior' }, 90_000);
  }

  @Post('virtual-makeup')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('face', upload))
  virtualMakeup(
    @UploadedFile() file: Express.Multer.File,
    @Body('style') style?: string,
    @Body('undertone') undertone?: string,
  ) {
    const face = VisionController.required(file, 'face');
    return this.ai.postFiles('/api/v1/vision/virtual-makeup', { face }, { style: style || 'natural_calido', undertone: undertone || 'Calido' });
  }

  @Post('match-compatibility')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'garment_a', maxCount: 1 }, { name: 'garment_b', maxCount: 1 }], upload))
  matchCompatibility(
    @UploadedFiles() files: { garment_a?: Express.Multer.File[]; garment_b?: Express.Multer.File[] },
    @Body('name_a') nameA?: string,
    @Body('name_b') nameB?: string,
  ) {
    const a = VisionController.required(files?.garment_a?.[0], 'garment_a');
    const b = VisionController.required(files?.garment_b?.[0], 'garment_b');
    return this.ai.postFiles(
      '/api/v1/recommendations/match-compatibility',
      { garment_a: a, garment_b: b },
      { name_a: nameA || 'Prenda superior', name_b: nameB || 'Prenda inferior' },
    );
  }
}
