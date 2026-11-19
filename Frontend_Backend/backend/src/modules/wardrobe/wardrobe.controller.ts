import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  Logger,
  Optional,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { WardrobeService } from './wardrobe.service';
import { UsageService } from '../subscriptions/usage.service';
import {
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  WARDROBE_CATEGORIES,
  WARDROBE_OCCASIONS,
  WARDROBE_SEASONS,
  WARDROBE_SUBCATEGORIES,
} from './entities/wardrobe-item.entity';
import { ScanGarmentDto } from './dto/scan-garment.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { UpdateWardrobeItemDto } from './dto/update-wardrobe-item.dto';
import { WardrobeFilterDto } from './dto/wardrobe-filter.dto';
import { UpdateSyncSettingsDto, RecordWearDto } from './dto/wardrobe-sync.dto';
import { GenerateOutfitsDto } from './dto/generate-outfits.dto';
import { OutfitGeneratorService } from './outfit-generator.service';
import { OutfitsService } from '../outfits/outfits.service';
import type { OutfitContext } from '../outfits/outfit.engine';
import { EvaluateStoreGarmentDto } from './dto/evaluate-store-garment.dto';
import { StoreGarmentEvaluatorService } from './store-garment-evaluator.service';

/**
 * Controlador del Armario Digital Inteligente (HU-009, HU-011, HU-040 y HU-24).
 * Preparado para consumo desde la aplicación móvil en React Native.
 * Garantiza aislamiento estricto por usuaria mediante JwtAuthGuard + @CurrentUser().
 */
@UseGuards(JwtAuthGuard)
@Controller('api/wardrobe')
export class WardrobeController {
  constructor(
    private readonly wardrobeService: WardrobeService,
    private readonly outfitGenerator: OutfitGeneratorService,
    private readonly storeGarmentEvaluator: StoreGarmentEvaluatorService,
    private readonly outfits: OutfitsService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  private readonly logger = new Logger(WardrobeController.name);

  /**
   * HU-24: Evalúa si una prenda que la usuaria está viendo en una tienda es compatible
   * con su perfil (colorimetría/estación personal) y su armario real, para evitar compras
   * que luego no utilice.
   */
  @Post('evaluate-purchase')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async evaluateStorePurchase(
    @CurrentUser() user: User,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: EvaluateStoreGarmentDto,
  ) {
    return this.storeGarmentEvaluator.evaluate(user.id, dto, photo);
  }

  /**
   * Informa a la aplicación móvil (React Native) los permisos de dispositivo requeridos
   * (cámara y galería de fotos) y los formatos/categorías admitidos antes de capturar (HU-009).
   */
  @Get('mobile-config')
  getMobileCaptureConfig() {
    return {
      permissionsRequired: {
        camera: {
          ios: 'NSCameraUsageDescription',
          android: 'android.permission.CAMERA',
          rationale:
            'Bellia necesita acceso a tu cámara para tomar fotografías de tus prendas y organizarlas en tu armario digital.',
        },
        gallery: {
          ios: 'NSPhotoLibraryUsageDescription',
          android: 'android.permission.READ_MEDIA_IMAGES',
          rationale:
            'Bellia necesita acceso a tu galería y almacenamiento de fotografías para que puedas elegir prendas existentes y agregarlas a tu armario.',
        },
      },
      uploadConstraints: {
        fieldName: 'photo',
        maxFileSizeBytes: 8 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        captureSources: ['camera', 'gallery'],
      },
      categories: WARDROBE_CATEGORIES,
      categoryLabels: CATEGORY_LABELS,
      subcategories: WARDROBE_SUBCATEGORIES,
      subcategoryLabels: SUBCATEGORY_LABELS,
      seasons: WARDROBE_SEASONS,
      occasions: WARDROBE_OCCASIONS,
    };
  }

  /**
   * HU-040: Obtiene el paquete completo de sincronización (estado de última sincronización,
   * interruptores de copia automática y modo sin conexión, datos de la cuenta, armario completo
   * e historial de acciones) para mantener disponible el armario entre sesiones y sin conexión.
   */
  @Get('sync')
  async getSyncSnapshot(@CurrentUser() user: User) {
    return this.wardrobeService.getSyncSnapshot(user.id);
  }

  /**
   * HU-040: Actualiza los interruptores de copia automática en la nube (`autoBackupEnabled`)
   * y modo sin conexión (`offlineModeEnabled`).
   */
  @Patch('sync/settings')
  async updateSyncSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateSyncSettingsDto,
  ) {
    return this.wardrobeService.updateSyncSettings(user.id, dto);
  }

  /**
   * HU-19: Genera combinaciones de vestimenta usando sólo las prendas confirmadas del armario.
   * Cada combinación tiene superior + inferior o una prenda de cuerpo entero; si faltan prendas,
   * responde `isSufficient: false` con lo que falta. Debe ir antes de `@Get(':id')`.
   */
  @Get('outfits')
  async generateOutfits(
    @CurrentUser() user: User,
    @Query() dto: GenerateOutfitsDto,
  ) {
    const items = await this.wardrobeService.findConfirmedItems(user.id);
    // Contexto personal (paleta, colores a evitar, Style DNA, valoraciones): el mismo que usa
    // /outfits/generate. Si falla, se generan combinaciones solo con las reglas básicas.
    let ctx: OutfitContext | undefined;
    try {
      ({ ctx } = await this.outfits.buildContext(user, {
        occasion: dto.occasion && dto.occasion !== 'todas' ? dto.occasion : undefined,
        temperatureC: dto.temperature,
        rainy: dto.weatherCondition === 'lluvia',
      }));
    } catch (err) {
      this.logger.warn(`Outfits sin contexto personal: ${(err as Error).message}`);
    }
    return this.outfitGenerator.generate(items, dto, ctx);
  }

  /**
   * HU-040: Obtiene el historial de acciones del armario de la usuaria (agregar, editar, eliminar)
   * con su fecha correspondiente para la pantalla "Perfil e historial".
   */
  @Get('history')
  async getWardrobeHistory(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.wardrobeService.getWardrobeHistory(
      user.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * HU-009: Escanea una vestimenta (desde cámara o galería), genera la imagen mejorada realista,
   * detecta color/talla aproximada/temporada y la guarda en la categoría correspondiente.
   * Si falla la subida de la fotografía, conserva automáticamente el borrador.
   */
  @Post('scan')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
      },
    ),
  )
  async scanGarment(
    @CurrentUser() user: User,
    @UploadedFiles()
    files: {
      photo?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
    @Body() dto: ScanGarmentDto,
  ) {
    const photo = files?.photo?.[0] || files?.file?.[0];
    if (!dto.draftId) await this.usage?.assertCanAddWardrobeItem(user.id);
    return this.wardrobeService.scanAndSaveGarment(user.id, photo, dto);
  }

  /**
   * HU-009: Crea un borrador de prenda (por ejemplo, antes de subir la imagen o cuando falla la red móvil).
   */
  @Post('drafts')
  async createDraft(@CurrentUser() user: User, @Body() dto: CreateDraftDto) {
    await this.usage?.assertCanAddWardrobeItem(user.id);
    return this.wardrobeService.createDraft(user.id, dto);
  }

  /**
   * HU-009: Adjunta o reintenta la subida de fotografía a un borrador existente y lo confirma.
   */
  @Patch(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async attachPhotoToDraft(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body('captureSource') captureSource?: 'camera' | 'gallery',
  ) {
    return this.wardrobeService.attachPhotoToDraft(
      user.id,
      id,
      photo,
      captureSource || 'camera',
    );
  }

  /**
   * HU-011: Registra que la usuaria utilizó una prenda ("última vez que se usó").
   */
  @Post(':id/wear')
  async recordGarmentWear(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordWearDto,
  ) {
    return this.wardrobeService.recordGarmentWear(user.id, id, dto);
  }

  /**
   * HU-011: Obtiene todas las prendas disponibles en el armario personal de la usuaria autenticada
   * con cuadrícula (`grid`), búsqueda por texto, filtros por categoría/color/temporada y mensaje de armario vacío.
   */
  @Get()
  async getMyWardrobe(@CurrentUser() user: User, @Query() filters: WardrobeFilterDto) {
    return this.wardrobeService.getMyWardrobe(user.id, filters);
  }

  /**
   * HU-011: Obtiene el detalle completo de una prenda del armario personal (foto grande,
   * atributos, fecha en que se añadió y última vez que se usó).
   */
  @Get(':id')
  async getGarmentById(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.wardrobeService.getGarmentById(user.id, id);
  }

  /**
   * HU-009 / HU-011: Edita los datos de una prenda o confirma un borrador en el armario.
   */
  @Patch(':id')
  async updateGarment(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWardrobeItemDto,
  ) {
    return this.wardrobeService.updateGarment(user.id, id, dto);
  }

  /**
   * HU-009 / HU-011: Elimina una prenda del armario personal de la usuaria.
   */
  @Delete(':id')
  async deleteGarment(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.wardrobeService.deleteGarment(user.id, id);
  }
}
