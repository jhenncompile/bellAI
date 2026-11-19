import { BadRequestException, Body, Controller, HttpCode, Injectable, Module, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import { AdminAuditService } from '../admin/audit/audit.service';
import { AdminModule } from '../admin/admin.module';
import { OutfitsModule } from '../outfits/outfits.module';
import { OutfitsService } from '../outfits/outfits.service';
import { evaluateCompatibility } from './compatibility.engine';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * HU-024 / HU-025: la foto se analiza en memoria y no se guarda (HU-034).
 * Si la usuaria compra la prenda puede añadirla al armario con /api/wardrobe/scan.
 */
@Injectable()
export class CompatibilityService {
  constructor(
    private readonly ai: AiGatewayService,
    private readonly settings: PlatformSettingsService,
    private readonly outfits: OutfitsService,
    private readonly audit: AdminAuditService,
  ) {}

  async evaluate(user: User, file: Express.Multer.File, body: { occasion?: string; price?: string; latitude?: string; longitude?: string; temperatureC?: string }) {
    if (!file) throw new BadRequestException('Adjunta la foto de la prenda en el campo "file".');
    if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Solo se aceptan fotos JPG, PNG o WEBP.');
    const thresholds = await this.settings.getPhotoThresholds();
    const analysis = await this.ai.postImage<{ quality: any; garment: any }>('/api/v1/analysis/garment', file, { thresholds }, 60_000);
    const g = analysis.garment;
    const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v));
    const { ctx, diagnosis } = await this.outfits.buildContext(user, {
      occasion: body.occasion,
      latitude: num(body.latitude),
      longitude: num(body.longitude),
      temperatureC: num(body.temperatureC),
    });
    const wardrobe = await this.outfits.wardrobe(user.id);
    const price = num(body.price);
    const result = evaluateCompatibility(
      {
        id: 'candidata', name: null, category: g.category, subcategory: g.subcategory, color: g.color, colorHex: g.colorHex,
        season: null, occasion: g.occasion ?? null, wearCount: 0, lastWornAt: new Date().toISOString(), styles: g.styles ?? [],
      },
      wardrobe,
      { ...ctx, garmentCuts: diagnosis?.recommendations?.garmentCuts ?? [], bodyType: diagnosis?.bodyType ?? null },
      Number.isFinite(price as number) ? (price as number) : null,
    );
    await this.audit.record({ actorUserId: user.id, action: 'COMPATIBILITY_CHECKED', entityType: 'compatibilidad', changes: { light: result.light, score: result.score } });
    return {
      ...result,
      garment: {
        category: g.category, subcategory: g.subcategory, color: g.color, colorHex: g.colorHex, pattern: g.pattern,
        style: g.style, confidence: g.confidence, method: g.method, modelVersion: g.modelVersion, alternatives: g.alternatives,
      },
      photoStored: false,
    };
  }
}

@ApiTags('Semáforo de compatibilidad')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/compatibility')
export class CompatibilityController {
  constructor(private readonly service: CompatibilityService) {}

  @Post()
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  evaluate(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File, @Body() body: Record<string, string>) {
    return this.service.evaluate(user, file, body);
  }
}

@Module({
  imports: [AdminModule, OutfitsModule],
  controllers: [CompatibilityController],
  providers: [CompatibilityService],
})
export class CompatibilityModule {}
