import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  WardrobeItem,
  DEFAULT_SUBCATEGORY_BY_CATEGORY,
  SUBCATEGORY_TO_CATEGORY,
  SUBCATEGORY_LABELS,
  CATEGORY_LABELS,
  WARDROBE_CATEGORIES,
  WARDROBE_SUBCATEGORIES,
  type WardrobeOccasion,
  type WardrobeCategory,
  type WardrobeSubcategory,
  type WardrobeSeason,
} from './entities/wardrobe-item.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { WardrobeEnhancementService } from './wardrobe-enhancement.service';
import { ScanGarmentDto } from './dto/scan-garment.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { UpdateWardrobeItemDto } from './dto/update-wardrobe-item.dto';
import { WardrobeFilterDto } from './dto/wardrobe-filter.dto';
import { UpdateSyncSettingsDto, RecordWearDto } from './dto/wardrobe-sync.dto';
import { PhotoAnalysisConsentService } from '../privacy/photo-analysis-consent.service';
import { signMediaPath } from '../../common/media/signed-url';

export interface FormattedWardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  captureSource: 'camera' | 'gallery';
  originalImageUrl: string | null;
  enhancedImageUrl: string | null;
  status: string;
  bottomDetails: {
    color: string | null;
    colorHex: string | null;
    approximateSize: string | null;
    season: WardrobeSeason | null;
    occasion: WardrobeOccasion | null;
    categoryLabel: string;
  };
  usageStats: {
    addedAt: Date;
    lastWornAt: Date | null;
    wearCount: number;
    lastWornLabel: string;
  };
  aiMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WARDROBE_HISTORY_ACTIONS: Record<
  string,
  { type: 'agregar' | 'editar' | 'eliminar'; label: string }
> = {
  WARDROBE_ITEM_SCANNED: {
    type: 'agregar',
    label: 'Prenda agregada al armario',
  },
  WARDROBE_DRAFT_SAVED: {
    type: 'agregar',
    label: 'Borrador de prenda guardado',
  },
  WARDROBE_UPLOAD_FAILED_DRAFT_SAVED: {
    type: 'agregar',
    label: 'Borrador conservado tras fallo de fotografía',
  },
  WARDROBE_ITEM_UPDATED: {
    type: 'editar',
    label: 'Prenda editada en el armario',
  },
  WARDROBE_ITEM_WORN: {
    type: 'editar',
    label: 'Uso de prenda registrado',
  },
  WARDROBE_ITEM_DELETED: {
    type: 'eliminar',
    label: 'Prenda eliminada del armario',
  },
};

export const EMPTY_WARDROBE_INVITATION = {
  title: 'Tu armario digital está vacío',
  message:
    'Aún no has registrado prendas. ¡Toma una foto o elígela de tu galería para agregar tu primera prenda!',
  ctaLabel: 'Agregar mi primera prenda',
};

@Injectable()
export class WardrobeService {
  constructor(
    @InjectRepository(WardrobeItem)
    private readonly wardrobeRepository: Repository<WardrobeItem>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly enhancementService: WardrobeEnhancementService,
    @Optional()
    private readonly photoAnalysisConsentService?: PhotoAnalysisConsentService,
    @Optional()
    @InjectRepository(Preferences)
    private readonly preferencesRepository?: Repository<Preferences>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,
    @Optional()
    @InjectRepository(Profile)
    private readonly profileRepository?: Repository<Profile>,
  ) {}

  /**
   * Escanea una vestimenta mediante fotografía tomada desde la cámara o elegida de la galería (HU-009):
   * - Mejora la imagen de forma realista tipo estudio/catálogo.
   * - Clasifica automáticamente en la categoría y subcategoría donde corresponde.
   * - Calcula las características inferiores (color, código HEX, talla aproximada, temporada).
   * - Regla HU-009: Si falla la subida o el procesamiento de la fotografía, conserva el borrador
   *   en el armario personal de la usuaria para que no pierda sus datos.
   */
  async scanAndSaveGarment(
    userId: string,
    file: Express.Multer.File | undefined,
    dto: ScanGarmentDto,
  ) {
    if (!userId) {
      throw new BadRequestException('Identificador de usuaria requerido');
    }

    const captureSource = dto.captureSource || 'camera';
    const fallbackCategory: WardrobeCategory =
      dto.category ||
      (dto.subcategory ? SUBCATEGORY_TO_CATEGORY[dto.subcategory] : 'superior');
    const fallbackSubcategory: WardrobeSubcategory =
      dto.subcategory ||
      (dto.category ? DEFAULT_SUBCATEGORY_BY_CATEGORY[dto.category] : 'otros');

    // Regla HU-009: Si no llega la fotografía o falla la transferencia desde el móvil,
    // se conserva el borrador con los datos enviados por la usuaria.
    if (!file || !file.buffer || file.buffer.length === 0) {
      const savedDraft = await this.saveFailedUploadDraft(userId, dto, {
        category: fallbackCategory,
        subcategory: fallbackSubcategory,
        captureSource,
        reason: 'No se recibió el archivo de fotografía o la subida se interrumpió.',
      });

      return {
        savedAsDraft: true,
        message:
          'No se pudo procesar la fotografía, pero se conservó el borrador de tu prenda para que puedas reintentar.',
        item: this.formatItemResponse(savedDraft),
      };
    }

    await this.photoAnalysisConsentService?.assertPhotoAnalysisConsent(userId);

    try {
      const enhanced = await this.enhancementService.processAndEnhanceGarment(file, {
        name: dto.name,
        category: dto.category,
        subcategory: dto.subcategory,
      });

      const finalSubcategory: WardrobeSubcategory =
        dto.subcategory ||
        (dto.category &&
        SUBCATEGORY_TO_CATEGORY[enhanced.subcategory] !== dto.category
          ? DEFAULT_SUBCATEGORY_BY_CATEGORY[dto.category]
          : enhanced.subcategory);
      const finalCategory: WardrobeCategory =
        dto.category || SUBCATEGORY_TO_CATEGORY[finalSubcategory] || enhanced.category;
      const finalColor = dto.color || enhanced.color;
      // HU-15: lo que la usuaria confirmó manda. Si escribió un color sin elegir muestra,
      // no se guarda el hexadecimal detectado por el servidor para no contradecirla.
      const finalColorHex = dto.colorHex ?? (dto.color ? null : enhanced.colorHex);
      const finalSize = dto.approximateSize || enhanced.approximateSize;
      const finalSeason = dto.season || enhanced.season;
      // HU-010: si la usuaria no indica ocasión se usa la sugerida por la IA (si es válida)
      const suggested = enhanced.aiMetadata?.suggestedOccasion as WardrobeOccasion | null | undefined;
      const finalOccasion =
        dto.occasion || (suggested && ['casual', 'formal', 'fiesta', 'deporte', 'trabajo', 'playa', 'gala'].includes(suggested) ? suggested : null);
      const finalName =
        dto.name?.trim() ||
        `${SUBCATEGORY_LABELS[finalSubcategory]} ${finalColor}`.trim();

      const shouldConfirm = dto.autoConfirm !== 'false';
      const finalStatus = shouldConfirm ? 'confirmed' : 'draft';

      let item: WardrobeItem;
      if (dto.draftId) {
        const existingDraft = await this.wardrobeRepository.findOne({
          where: { id: dto.draftId, userId },
        });
        if (!existingDraft) {
          throw new NotFoundException('Borrador no encontrado en tu armario personal');
        }
        existingDraft.name = finalName;
        existingDraft.category = finalCategory;
        existingDraft.subcategory = finalSubcategory;
        existingDraft.color = finalColor;
        existingDraft.colorHex = finalColorHex;
        existingDraft.approximateSize = finalSize;
        existingDraft.season = finalSeason;
        if (dto.occasion !== undefined) existingDraft.occasion = dto.occasion;
        existingDraft.captureSource = captureSource;
        existingDraft.originalImageUrl = enhanced.originalImageUrl;
        existingDraft.enhancedImageUrl = enhanced.enhancedImageUrl;
        existingDraft.status = finalStatus;
        existingDraft.aiMetadata = enhanced.aiMetadata;
        item = await this.wardrobeRepository.save(existingDraft);
      } else {
        const newItem = this.wardrobeRepository.create({
          userId,
          name: finalName,
          category: finalCategory,
          subcategory: finalSubcategory,
          color: finalColor,
          colorHex: finalColorHex,
          approximateSize: finalSize,
          season: finalSeason,
          occasion: finalOccasion,
          captureSource,
          originalImageUrl: enhanced.originalImageUrl,
          enhancedImageUrl: enhanced.enhancedImageUrl,
          status: finalStatus,
          lastWornAt: null,
          wearCount: 0,
          aiMetadata: enhanced.aiMetadata,
        });
        item = await this.wardrobeRepository.save(newItem);
      }

      await this.recordAudit(userId, 'WARDROBE_ITEM_SCANNED', {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        subcategory: item.subcategory,
        captureSource: item.captureSource,
        status: item.status,
      });
      await this.touchLastSyncedAt(userId);

      return {
        savedAsDraft: false,
        message:
          'Prenda escaneada, mejorada y clasificada automáticamente en tu armario personal.',
        item: this.formatItemResponse(item),
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const savedDraft = await this.saveFailedUploadDraft(userId, dto, {
        category: fallbackCategory,
        subcategory: fallbackSubcategory,
        captureSource,
        reason: error?.message || 'Error al procesar la fotografía de la prenda.',
      });

      return {
        savedAsDraft: true,
        message:
          'Falló el procesamiento de la fotografía, pero se conservó el borrador de la prenda en tu armario.',
        errorDetail: error?.message || 'Archivo de imagen inválido',
        item: this.formatItemResponse(savedDraft),
      };
    }
  }

  /**
   * Crea explícitamente un borrador de prenda antes de adjuntar la fotografía
   * o cuando la app móvil detecta corte de conexión al subir la imagen (HU-009).
   */
  async createDraft(userId: string, dto: CreateDraftDto) {
    const category: WardrobeCategory =
      dto.category ||
      (dto.subcategory ? SUBCATEGORY_TO_CATEGORY[dto.subcategory] : 'superior');
    const subcategory: WardrobeSubcategory =
      dto.subcategory ||
      (dto.category ? DEFAULT_SUBCATEGORY_BY_CATEGORY[category] : 'otros');

    const draft = this.wardrobeRepository.create({
      userId,
      name: dto.name?.trim() || `${SUBCATEGORY_LABELS[subcategory]} (Borrador)`,
      category,
      subcategory,
      color: dto.color || null,
      colorHex: null,
      approximateSize: dto.approximateSize || null,
      season: dto.season || null,
      occasion: dto.occasion || null,
      captureSource: dto.captureSource || 'camera',
      originalImageUrl: null,
      enhancedImageUrl: null,
      status: 'draft',
      lastWornAt: null,
      wearCount: 0,
      aiMetadata: { draftSavedAt: new Date().toISOString() },
    });

    const saved = await this.wardrobeRepository.save(draft);

    await this.recordAudit(userId, 'WARDROBE_DRAFT_SAVED', {
      itemId: saved.id,
      itemName: saved.name,
      category: saved.category,
      subcategory: saved.subcategory,
    });
    await this.touchLastSyncedAt(userId);

    return {
      message: 'Borrador de prenda guardado en tu armario personal.',
      item: this.formatItemResponse(saved),
    };
  }

  /**
   * Reintenta la subida de fotografía sobre un borrador existente y lo confirma en el armario (HU-009).
   */
  async attachPhotoToDraft(
    userId: string,
    itemId: string,
    file: Express.Multer.File | undefined,
    captureSource: 'camera' | 'gallery' = 'camera',
  ) {
    const existing = await this.wardrobeRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Prenda o borrador no encontrado en tu armario personal');
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      existing.status = 'upload_failed';
      await this.wardrobeRepository.save(existing);
      throw new BadRequestException(
        'Debes adjuntar una fotografía válida desde la cámara o galería. Tu borrador sigue conservado.',
      );
    }

    return this.scanAndSaveGarment(userId, file, {
      draftId: existing.id,
      name: existing.name || undefined,
      category: existing.category,
      subcategory: existing.subcategory !== 'otros' ? existing.subcategory : undefined,
      color: existing.color || undefined,
      approximateSize: existing.approximateSize || undefined,
      season: existing.season || undefined,
      captureSource,
      autoConfirm: 'true',
    });
  }

  /**
   * Lista las prendas disponibles en el armario personal de la usuaria autenticada (HU-011):
   * - Cuadrícula con foto, nombre y categoría de cada prenda.
   * - Búsqueda y filtros combinables por texto, categoría, subcategoría, color, temporada y ocasión.
   * - Armario vacío: si no hay prendas registradas, devuelve `isEmpty = true` y un mensaje de invitación
   *   para agregar la primera prenda (`emptyState`).
   */
  /**
   * HU-19: Prendas confirmadas de la usuaria, materia prima del generador de combinaciones.
   * Los borradores y las subidas fallidas no cuentan como prendas registradas.
   */
  async findConfirmedItems(userId: string): Promise<WardrobeItem[]> {
    return this.wardrobeRepository.find({
      where: { userId, status: 'confirmed' },
      order: { createdAt: 'DESC' },
    });
  }

  async getMyWardrobe(userId: string, filters?: WardrobeFilterDto) {
    const query = this.wardrobeRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId });

    if (filters?.category) {
      query.andWhere('item.category = :category', { category: filters.category });
    }
    if (filters?.subcategory) {
      query.andWhere('item.subcategory = :subcategory', {
        subcategory: filters.subcategory,
      });
    }
    if (filters?.season) {
      query.andWhere('item.season = :season', { season: filters.season });
    }
    if (filters?.occasion) {
      query.andWhere('item.occasion = :occasion', { occasion: filters.occasion });
    }
    if (filters?.status) {
      query.andWhere('item.status = :status', { status: filters.status });
    }
    if (filters?.color) {
      query.andWhere(
        '(item.color ILIKE :color OR item.colorHex ILIKE :color)',
        { color: `%${filters.color}%` },
      );
    }
    if (filters?.search) {
      query.andWhere(
        '(item.name ILIKE :search OR item.color ILIKE :search OR item.colorHex ILIKE :search OR item.subcategory ILIKE :search OR item.category ILIKE :search OR item.season ILIKE :search OR item.occasion ILIKE :search OR item.status ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const items = await query.orderBy('item.createdAt', 'DESC').getMany();
    const allItems = await this.wardrobeRepository.find({ where: { userId } });
    const byCategory: Record<WardrobeCategory, number> = {
      superior: 0,
      inferior: 0,
      calzado: 0,
      abrigo: 0,
      accesorio: 0,
    };

    const bySubcategory: Record<string, number> = {};
    for (const sub of WARDROBE_SUBCATEGORIES) {
      bySubcategory[sub] = 0;
    }

    let confirmedCount = 0;
    let draftCount = 0;

    for (const item of allItems) {
      if (item.status === 'confirmed') {
        confirmedCount += 1;
        if (byCategory[item.category] !== undefined) {
          byCategory[item.category] += 1;
        }
        bySubcategory[item.subcategory] = (bySubcategory[item.subcategory] || 0) + 1;
      } else {
        draftCount += 1;
      }
    }

    const isWardrobeEmpty = allItems.length === 0;
    const formattedItems = items.map((item) => this.formatItemResponse(item));

    // Formato de cuadrícula optimizado para la pantalla "Mi armario" (HU-011)
    const grid = formattedItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      categoryLabel: item.bottomDetails.categoryLabel,
      photoUrl: item.enhancedImageUrl || item.originalImageUrl,
      imageUrl: item.enhancedImageUrl || item.originalImageUrl,
      color: item.bottomDetails.color,
      colorHex: item.bottomDetails.colorHex,
      season: item.bottomDetails.season,
      occasion: item.bottomDetails.occasion,
      status: item.status,
      addedAt: item.usageStats.addedAt,
      lastWornAt: item.usageStats.lastWornAt,
    }));

    return {
      isEmpty: isWardrobeEmpty,
      emptyState: isWardrobeEmpty
        ? EMPTY_WARDROBE_INVITATION
        : items.length === 0
          ? {
              title: 'Sin coincidencias para tu búsqueda',
              message:
                'No encontramos prendas con los filtros seleccionados. Prueba limpiando los filtros.',
              ctaLabel: 'Ver todo mi armario',
            }
          : null,
      summary: {
        totalConfirmed: confirmedCount,
        totalDrafts: draftCount,
        byCategory,
        bySubcategory,
      },
      grid,
      items: formattedItems,
    };
  }

  /**
   * Obtiene el detalle de una prenda específica (HU-011):
   * Muestra foto grande, atributos, fecha en que se añadió (`addedAt`),
   * última vez que se usó (`lastWornAt` / `wearCount`) y habilita acciones Editar y Eliminar.
   */
  async getGarmentById(userId: string, itemId: string) {
    const item = await this.wardrobeRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('La prenda solicitada no existe en tu armario personal');
    }

    return this.formatItemResponse(item);
  }

  /**
   * Registra que la usuaria utilizó una prenda hoy o en una fecha determinada (HU-011),
   * actualizando `lastWornAt` ("última vez que se usó") y el contador `wearCount`.
   */
  async recordGarmentWear(userId: string, itemId: string, dto?: RecordWearDto) {
    const item = await this.wardrobeRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('La prenda solicitada no existe en tu armario personal');
    }

    const wornDate = dto?.wornAt ? new Date(dto.wornAt) : new Date();
    item.lastWornAt = wornDate;
    item.wearCount = (item.wearCount || 0) + 1;

    const saved = await this.wardrobeRepository.save(item);

    await this.recordAudit(userId, 'WARDROBE_ITEM_WORN', {
      itemId: saved.id,
      itemName: saved.name,
      category: saved.category,
      subcategory: saved.subcategory,
      lastWornAt: saved.lastWornAt.toISOString(),
      wearCount: saved.wearCount,
    });
    await this.touchLastSyncedAt(userId);

    return {
      message: 'Se registró el uso de la prenda en tu armario.',
      item: this.formatItemResponse(saved),
    };
  }

  /**
   * Edita los datos de una prenda (nombre, categoría, subcategoría, color, talla aproximada, temporada)
   * o confirma un borrador verificando que tenga foto y categoría obligatorias (HU-009 / HU-011).
   */
  async updateGarment(userId: string, itemId: string, dto: UpdateWardrobeItemDto) {
    const item = await this.wardrobeRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('La prenda solicitada no existe en tu armario personal');
    }

    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.subcategory !== undefined) {
      item.subcategory = dto.subcategory;
      if (!dto.category) {
        item.category = SUBCATEGORY_TO_CATEGORY[dto.subcategory];
      }
    }
    if (dto.category !== undefined) {
      if (!WARDROBE_CATEGORIES.includes(dto.category)) {
        throw new BadRequestException('Categoría de prenda inválida');
      }
      item.category = dto.category;
      if (
        dto.subcategory === undefined &&
        SUBCATEGORY_TO_CATEGORY[item.subcategory] !== dto.category
      ) {
        item.subcategory = DEFAULT_SUBCATEGORY_BY_CATEGORY[dto.category];
      }
    }
    if (dto.color !== undefined) item.color = dto.color;
    if (dto.colorHex !== undefined) item.colorHex = dto.colorHex;
    if (dto.approximateSize !== undefined) item.approximateSize = dto.approximateSize;
    if (dto.season !== undefined) item.season = dto.season;
    if (dto.occasion !== undefined) item.occasion = dto.occasion;

    if (dto.status !== undefined) {
      if (
        dto.status === 'confirmed' &&
        (!item.enhancedImageUrl || !item.originalImageUrl || !item.category)
      ) {
        throw new BadRequestException(
          'Para confirmar la prenda en el armario, la fotografía y la categoría son obligatorias.',
        );
      }
      item.status = dto.status;
    }

    const updated = await this.wardrobeRepository.save(item);

    await this.recordAudit(userId, 'WARDROBE_ITEM_UPDATED', {
      itemId: updated.id,
      itemName: updated.name,
      category: updated.category,
      subcategory: updated.subcategory,
      status: updated.status,
    });
    await this.touchLastSyncedAt(userId);

    return {
      message: 'Prenda actualizada correctamente en tu armario.',
      item: this.formatItemResponse(updated),
    };
  }

  /**
   * Elimina una prenda del armario personal de la usuaria y borra sus archivos de imagen (HU-009 / HU-011).
   */
  async deleteGarment(userId: string, itemId: string) {
    const item = await this.wardrobeRepository.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('La prenda solicitada no existe en tu armario personal');
    }

    const itemName = item.name || SUBCATEGORY_LABELS[item.subcategory] || 'Prenda';

    await this.enhancementService.removeGarmentImages([
      item.originalImageUrl,
      item.enhancedImageUrl,
    ]);
    await this.wardrobeRepository.remove(item);

    await this.recordAudit(userId, 'WARDROBE_ITEM_DELETED', {
      itemId,
      itemName,
      category: item.category,
      subcategory: item.subcategory,
    });
    await this.touchLastSyncedAt(userId);

    return {
      message: 'Prenda eliminada correctamente de tu armario personal.',
      deletedId: itemId,
    };
  }

  /**
   * HU-040: Obtiene el historial de acciones del armario de la usuaria (agregar, editar, eliminar)
   * con su fecha y detalle legible para la pantalla "Perfil e historial".
   */
  async getWardrobeHistory(userId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const wardrobeActions = Object.keys(WARDROBE_HISTORY_ACTIONS);
    const logs = wardrobeActions.length
      ? await this.auditLogRepository
          .createQueryBuilder('auditLog')
          .select([
            'auditLog.id',
            'auditLog.action',
            'auditLog.details',
            'auditLog.createdAt',
          ])
          .where('auditLog.userId = :userId', { userId })
          .andWhere('auditLog.action IN (:...actions)', { actions: wardrobeActions })
          .orderBy('auditLog.createdAt', 'DESC')
          .take(safeLimit)
          .getMany()
      : [];

    const history = logs.map((log) => {
      const meta = WARDROBE_HISTORY_ACTIONS[log.action];
      const details = (log.details || {}) as Record<string, any>;
      return {
        id: log.id,
        actionCode: log.action,
        actionType: meta.type,
        title: meta.label,
        itemId: details.itemId || null,
        itemName: details.itemName || null,
        category: details.category || null,
        subcategory: details.subcategory || null,
        occurredAt: log.createdAt,
      };
    });

    return {
      total: history.length,
      history,
    };
  }

  /**
   * HU-040: Devuelve el estado de sincronización en la nube, interruptores de copia automática
   * y modo sin conexión, perfil de la cuenta, historial de acciones y paquete completo del armario
   * para persistencia offline entre sesiones y dispositivos.
   */
  async getSyncSnapshot(userId: string) {
    const [wardrobeData, historyData, preferences, accountInfo] = await Promise.all([
      this.getMyWardrobe(userId, {}),
      this.getWardrobeHistory(userId, 50),
      this.getOrCreateSyncPreferences(userId),
      this.getAccountSnapshot(userId),
    ]);

    const now = new Date();
    if (preferences.autoBackupEnabled && this.preferencesRepository) {
      preferences.lastSyncedAt = now;
      await this.preferencesRepository.save(preferences);
    }

    const lastSyncedAt = preferences.lastSyncedAt || now;

    return {
      syncStatus: {
        backedUpInCloud: true,
        autoBackupEnabled: preferences.autoBackupEnabled,
        offlineModeEnabled: preferences.offlineModeEnabled,
        lastSyncedAt,
        statusMessage: `Sincronizado en la nube (${lastSyncedAt.toISOString()})`,
      },
      account: accountInfo,
      wardrobe: wardrobeData,
      history: historyData.history,
    };
  }

  /**
   * HU-040: Actualiza los interruptores de "Copia automática en la nube" (`autoBackupEnabled`)
   * y "Modo sin conexión" (`offlineModeEnabled`) desde la pantalla "Perfil e historial".
   */
  async updateSyncSettings(userId: string, dto: UpdateSyncSettingsDto) {
    const preferences = await this.getOrCreateSyncPreferences(userId);

    if (dto.autoBackupEnabled !== undefined) {
      preferences.autoBackupEnabled = dto.autoBackupEnabled;
    }
    if (dto.offlineModeEnabled !== undefined) {
      preferences.offlineModeEnabled = dto.offlineModeEnabled;
    }
    preferences.lastSyncedAt = new Date();

    if (this.preferencesRepository) {
      await this.preferencesRepository.save(preferences);
    }

    return {
      message: 'Preferencias de sincronización y disponibilidad actualizadas.',
      syncStatus: {
        backedUpInCloud: true,
        autoBackupEnabled: preferences.autoBackupEnabled,
        offlineModeEnabled: preferences.offlineModeEnabled,
        lastSyncedAt: preferences.lastSyncedAt,
      },
    };
  }

  private async saveFailedUploadDraft(
    userId: string,
    dto: ScanGarmentDto,
    meta: {
      category: WardrobeCategory;
      subcategory: WardrobeSubcategory;
      captureSource: 'camera' | 'gallery';
      reason: string;
    },
  ): Promise<WardrobeItem> {
    if (dto.draftId) {
      const existing = await this.wardrobeRepository.findOne({
        where: { id: dto.draftId, userId },
      });
      if (existing) {
        if (dto.name) existing.name = dto.name.trim();
        if (dto.category) existing.category = dto.category;
        if (dto.subcategory) existing.subcategory = dto.subcategory;
        if (dto.color) existing.color = dto.color;
        if (dto.approximateSize) existing.approximateSize = dto.approximateSize;
        if (dto.season) existing.season = dto.season;
        if (dto.occasion !== undefined) existing.occasion = dto.occasion;
        existing.captureSource = meta.captureSource;
        existing.status = 'upload_failed';
        existing.aiMetadata = {
          ...(existing.aiMetadata || {}),
          lastUploadError: meta.reason,
          failedAt: new Date().toISOString(),
        };
        return this.wardrobeRepository.save(existing);
      }
    }

    const draft = this.wardrobeRepository.create({
      userId,
      name:
        dto.name?.trim() ||
        `${SUBCATEGORY_LABELS[meta.subcategory]} (Borrador pendiente de foto)`,
      category: meta.category,
      subcategory: meta.subcategory,
      color: dto.color || null,
      colorHex: null,
      approximateSize: dto.approximateSize || null,
      season: dto.season || null,
      occasion: dto.occasion || null,
      captureSource: meta.captureSource,
      originalImageUrl: null,
      enhancedImageUrl: null,
      status: 'upload_failed',
      lastWornAt: null,
      wearCount: 0,
      aiMetadata: {
        lastUploadError: meta.reason,
        failedAt: new Date().toISOString(),
      },
    });

    const saved = await this.wardrobeRepository.save(draft);

    await this.recordAudit(userId, 'WARDROBE_UPLOAD_FAILED_DRAFT_SAVED', {
      itemId: saved.id,
      itemName: saved.name,
      category: saved.category,
      captureSource: saved.captureSource,
    });
    await this.touchLastSyncedAt(userId);

    return saved;
  }

  private formatItemResponse(item: WardrobeItem): FormattedWardrobeItem {
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    const subLabel = SUBCATEGORY_LABELS[item.subcategory] || item.subcategory;
    const addedAt = item.createdAt || new Date();
    const lastWornAt = item.lastWornAt || null;
    const wearCount = item.wearCount ?? 0;

    return {
      id: item.id,
      userId: item.userId,
      name: item.name || `${subLabel} ${item.color || ''}`.trim(),
      category: item.category,
      subcategory: item.subcategory,
      captureSource: item.captureSource || 'camera',
      // HU-034: URLs firmadas y con caducidad (las fotos solo las ve su dueña)
      originalImageUrl: signMediaPath(item.originalImageUrl),
      enhancedImageUrl: signMediaPath(item.enhancedImageUrl),
      status: item.status,
      bottomDetails: {
        color: item.color,
        colorHex: item.colorHex,
        approximateSize: item.approximateSize,
        season: item.season,
        occasion: item.occasion,
        categoryLabel: `${catLabel} • ${subLabel}`,
      },
      usageStats: {
        addedAt,
        lastWornAt,
        wearCount,
        lastWornLabel: lastWornAt
          ? `Usada por última vez el ${new Date(lastWornAt).toISOString().slice(0, 10)}`
          : 'Aún sin estrenar en tu armario',
      },
      aiMetadata: item.aiMetadata || {},
      createdAt: addedAt,
      updatedAt: item.updatedAt,
    };
  }

  private async getOrCreateSyncPreferences(userId: string): Promise<{
    userId: string;
    autoBackupEnabled: boolean;
    offlineModeEnabled: boolean;
    lastSyncedAt: Date | null;
  }> {
    if (!this.preferencesRepository) {
      return {
        userId,
        autoBackupEnabled: true,
        offlineModeEnabled: true,
        lastSyncedAt: new Date(),
      };
    }

    let prefs = await this.preferencesRepository.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.preferencesRepository.create({
        id: randomUUID(),
        userId,
        theme: 'system',
        language: 'es',
        emailNotifications: true,
        pushNotifications: true,
        marketingConsent: false,
        trackingConsent: false,
        autoBackupEnabled: true,
        offlineModeEnabled: true,
        lastSyncedAt: new Date(),
      });
      prefs = await this.preferencesRepository.save(prefs);
    }

    return prefs;
  }

  private async touchLastSyncedAt(userId: string): Promise<void> {
    if (!this.preferencesRepository) return;
    try {
      const prefs = await this.preferencesRepository.findOne({ where: { userId } });
      if (prefs && prefs.autoBackupEnabled !== false) {
        prefs.lastSyncedAt = new Date();
        await this.preferencesRepository.save(prefs);
      }
    } catch {
      // No interrumpir operación si no se puede actualizar timestamp de sincronización
    }
  }

  private async getAccountSnapshot(userId: string) {
    if (!this.userRepository) {
      return { id: userId };
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const profile = this.profileRepository
      ? await this.profileRepository.findOne({ where: { userId } })
      : null;

    return {
      id: user?.id || userId,
      name: user?.name || '',
      email: user?.email || '',
      avatarUrl: profile?.avatarUrl || null,
      bio: profile?.bio || '',
    };
  }

  private async recordAudit(
    userId: string,
    action: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        userId,
        action,
        details,
      });
      await this.auditLogRepository.save(log);
    } catch {
      // No interrumpir el flujo de la usuaria si el log secundario falla
    }
  }
}
