import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import { MediaAsset, MediaType, SystemFunction } from './entities/media-asset.entity';
import { StorageService } from '../storage/storage.service';
import { UploadMediaDto, PresignedUploadDto, ConfirmUploadDto } from './dto/media.dto';
import { AuditLog } from '../privacy/entities/audit-log.entity';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  // Mapeo de extensiones para modelos de IA
  private readonly AI_EXTENSIONS: Record<string, string> = {
    '.pt': 'application/octet-stream',
    '.pth': 'application/octet-stream',
    '.onnx': 'application/octet-stream',
    '.bin': 'application/octet-stream',
    '.h5': 'application/x-hdf5',
    '.tflite': 'application/octet-stream',
  };

  // Mapeo de extensiones para modelos 3D y prendas
  private readonly MODEL_3D_EXTENSIONS: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'application/octet-stream',
    '.stl': 'model/stl',
    '.ply': 'application/octet-stream',
    '.usdz': 'model/vnd.usdz+zip',
  };

  // Mapeo de extensiones para texturas
  private readonly TEXTURE_EXTENSIONS: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.tga': 'image/x-tga',
    '.dds': 'image/vnd-ms.dds',
    '.hdr': 'image/vnd.radiance',
    '.exr': 'image/x-exr',
  };

  // Mapeo de extensiones para fotografías estándar
  private readonly PHOTO_EXTENSIONS: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
  };

  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Determina la categoría de recurso según su extensión, nombre y parámetros
   */
  private detectMediaType(
    filename: string,
    explicitType?: 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture',
  ): MediaType {
    if (explicitType) return explicitType;

    const ext = path.extname(filename).toLowerCase();
    if (this.AI_EXTENSIONS[ext]) return 'ai_component';
    if (filename.toLowerCase().includes('prenda') || filename.toLowerCase().includes('garment')) {
      return 'garment';
    }
    if (this.MODEL_3D_EXTENSIONS[ext]) return 'model_3d';
    if (this.TEXTURE_EXTENSIONS[ext]) return 'texture';
    if (this.PHOTO_EXTENSIONS[ext]) return 'photo';

    return 'photo';
  }

  /**
   * Determina la función del recurso en la plataforma
   */
  private resolveSystemFunction(
    mediaType: MediaType,
    explicitFunction?: SystemFunction,
  ): SystemFunction {
    if (explicitFunction) return explicitFunction;

    switch (mediaType) {
      case 'garment':
        return 'catalogo_prendas';
      case 'model_3d':
        return 'probador_virtual_3d';
      case 'ai_component':
        return 'motor_inferencia_ia';
      case 'photo':
        return 'galeria_marketing';
      case 'avatar':
        return 'perfil_usuario';
      default:
        return 'general';
    }
  }

  /**
   * Determina el MIME Type óptimo con headers CDN
   */
  private resolveMimeType(filename: string, mediaType: MediaType, rawMime?: string): string {
    const ext = path.extname(filename).toLowerCase();

    if (mediaType === 'ai_component' && this.AI_EXTENSIONS[ext]) {
      return this.AI_EXTENSIONS[ext];
    }
    if ((mediaType === 'model_3d' || mediaType === 'garment') && this.MODEL_3D_EXTENSIONS[ext]) {
      return this.MODEL_3D_EXTENSIONS[ext];
    }
    if (mediaType === 'texture' && this.TEXTURE_EXTENSIONS[ext]) {
      return this.TEXTURE_EXTENSIONS[ext];
    }
    if (mediaType === 'photo' && this.PHOTO_EXTENSIONS[ext]) {
      return this.PHOTO_EXTENSIONS[ext];
    }

    return rawMime || 'application/octet-stream';
  }

  /**
   * Comprueba si una dimensión es potencia de dos (requerido para shaders de texturas 3D)
   */
  private isPowerOfTwo(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }

  /**
   * Procesa y sube cualquier recurso multimedia o modelo supervisado
   */
  async processAndUploadMedia(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    userId?: string,
  ): Promise<MediaAsset> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    const originalFilename = file.originalname || 'unnamed_file';
    const ext = path.extname(originalFilename).toLowerCase();
    const mediaType = this.detectMediaType(originalFilename, dto.mediaType);
    const systemFunction = this.resolveSystemFunction(mediaType, dto.systemFunction);
    const mimeType = this.resolveMimeType(originalFilename, mediaType, file.mimetype);

    let processedBuffer = file.buffer;
    let metadata: Record<string, any> = {
      originalSize: file.size,
      extension: ext,
    };

    // Procesamiento por categoría
    if (mediaType === 'photo') {
      if (file.buffer.length > 25 * 1024 * 1024) {
        throw new BadRequestException('La fotografía no debe superar los 25MB');
      }

      try {
        const image = sharp(file.buffer).rotate();
        const imageMetadata = await image.metadata();

        metadata = {
          ...metadata,
          width: imageMetadata.width,
          height: imageMetadata.height,
          channels: imageMetadata.channels,
          format: imageMetadata.format,
          aspectRatio:
            imageMetadata.width && imageMetadata.height
              ? (imageMetadata.width / imageMetadata.height).toFixed(2)
              : null,
          exifStripped: true, // Cumplimiento GDPR
        };

        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
          processedBuffer = await image.webp({ quality: 86, effort: 4 }).toBuffer();
          metadata.optimizedTo = 'webp';
          metadata.compressionRatio = `${(((file.buffer.length - processedBuffer.length) / file.buffer.length) * 100).toFixed(1)}%`;
        }
      } catch (err: any) {
        this.logger.warn(`Procesamiento Sharp omitido: ${err.message}`);
      }
    } else if (mediaType === 'model_3d' || mediaType === 'garment') {
      if (file.buffer.length > 100 * 1024 * 1024) {
        throw new BadRequestException('El modelo 3D/prenda excede el límite de 100MB');
      }

      if (ext === '.glb') {
        const magic = file.buffer.toString('utf8', 0, 4);
        if (magic !== 'glTF') {
          throw new BadRequestException('El archivo .glb no contiene cabecera glTF binaria válida');
        }
        metadata.format = 'glTF 2.0 Binary';
      } else if (ext === '.gltf') {
        try {
          const parsed = JSON.parse(file.buffer.toString('utf8'));
          metadata.format = 'glTF JSON';
          metadata.assetVersion = parsed.asset?.version || '2.0';
        } catch {
          throw new BadRequestException('El archivo .gltf contiene JSON malformado');
        }
      } else {
        metadata.format = ext.replace('.', '').toUpperCase();
      }

      metadata.readyForWebGL = true;
      metadata.supportsThreeJS = true;
    } else if (mediaType === 'ai_component') {
      if (file.buffer.length > 250 * 1024 * 1024) {
        throw new BadRequestException('El componente de IA excede el límite de 250MB');
      }
      metadata.format = ext === '.pt' || ext === '.pth' ? 'PyTorch Weight' : ext.replace('.', '').toUpperCase();
      metadata.framework = 'PyTorch / TorchScript / ONNX';
      metadata.pipelineCompatible = true;
    } else if (mediaType === 'texture') {
      if (file.buffer.length > 30 * 1024 * 1024) {
        throw new BadRequestException('La textura excede el tamaño máximo de 30MB');
      }
      metadata.textureType = dto.textureType || 'albedo';

      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        try {
          const imageMetadata = await sharp(file.buffer).metadata();
          const w = imageMetadata.width || 0;
          const h = imageMetadata.height || 0;
          metadata.width = w;
          metadata.height = h;
          metadata.isPowerOfTwo = this.isPowerOfTwo(w) && this.isPowerOfTwo(h);
          metadata.resolution = `${w}x${h}`;
        } catch (err: any) {
          this.logger.warn(`Error al leer textura: ${err.message}`);
        }
      }
    }

    // Partición de carpeta en S3
    const hash = crypto.randomBytes(16).toString('hex');
    const folderPrefix =
      mediaType === 'photo'
        ? 'photos'
        : mediaType === 'garment'
          ? 'garments'
          : mediaType === 'model_3d'
            ? 'models-3d'
            : mediaType === 'ai_component'
              ? 'ai-models'
              : 'textures';

    const finalExt = metadata.optimizedTo ? `.${metadata.optimizedTo}` : ext;
    const finalMime = metadata.optimizedTo ? 'image/webp' : mimeType;
    const s3Key = `${folderPrefix}/${hash}_${path.basename(originalFilename, ext)}${finalExt}`;

    // Subida a S3 / Object Storage con cache inmutable para CDN
    const uploadResult = await this.storageService.uploadFile({
      key: s3Key,
      buffer: processedBuffer,
      contentType: finalMime,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        mediaType,
        systemFunction,
        originalName: encodeURIComponent(originalFilename),
      },
    });

    const mediaAsset = this.mediaRepo.create({
      userId: userId || null,
      title: dto.title || originalFilename,
      originalFilename,
      s3Key,
      s3Bucket: uploadResult.bucket,
      s3Url: uploadResult.s3Url,
      cdnUrl: uploadResult.cdnUrl,
      mediaType,
      systemFunction,
      isActive: true,
      usedByComponents: dto.usedByComponents || [],
      status: 'active',
      mimeType: finalMime,
      extension: finalExt,
      sizeBytes: processedBuffer.length,
      metadata,
    });

    const saved = await this.mediaRepo.save(mediaAsset);

    // Auditoría de acción administrativa
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: userId || null,
        action: 'MEDIA_ASSET_UPLOADED',
        details: {
          assetId: saved.id,
          title: saved.title,
          mediaType: saved.mediaType,
          systemFunction: saved.systemFunction,
          cdnUrl: saved.cdnUrl,
        },
      }),
    );

    return saved;
  }

  /**
   * Genera URL prefirmada para subida directa (Direct-to-S3)
   */
  async createPresignedUpload(dto: PresignedUploadDto, userId?: string) {
    const ext = path.extname(dto.filename).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const folderPrefix =
      dto.mediaType === 'photo'
        ? 'photos'
        : dto.mediaType === 'garment'
          ? 'garments'
          : dto.mediaType === 'model_3d'
            ? 'models-3d'
            : dto.mediaType === 'ai_component'
              ? 'ai-models'
              : 'textures';

    const s3Key = `${folderPrefix}/${hash}_${path.basename(dto.filename, ext)}${ext}`;
    const mimeType = this.resolveMimeType(dto.filename, dto.mediaType, dto.contentType);

    const presigned = await this.storageService.getPresignedUploadUrl(s3Key, mimeType, 1800);

    return {
      ...presigned,
      mediaType: dto.mediaType,
      systemFunction: this.resolveSystemFunction(dto.mediaType, dto.systemFunction),
      originalFilename: dto.filename,
      mimeType,
      extension: ext,
      suggestedTitle: dto.title || dto.filename,
      usedByComponents: dto.usedByComponents || [],
    };
  }

  /**
   * Confirma la subida directa a S3 y registra el recurso
   */
  async confirmPresignedUpload(dto: ConfirmUploadDto, userId?: string): Promise<MediaAsset> {
    const cdnUrl = this.storageService.getCdnUrl(dto.key);
    const ext = path.extname(dto.originalFilename).toLowerCase();
    const systemFunction = this.resolveSystemFunction(dto.mediaType, dto.systemFunction);

    const asset = this.mediaRepo.create({
      userId: userId || null,
      title: dto.title,
      originalFilename: dto.originalFilename,
      s3Key: dto.key,
      s3Bucket: this.storageService.getStatus().bucket,
      s3Url: cdnUrl,
      cdnUrl: cdnUrl,
      mediaType: dto.mediaType,
      systemFunction,
      isActive: true,
      usedByComponents: dto.usedByComponents || [],
      status: 'active',
      mimeType: dto.mimeType,
      extension: ext,
      sizeBytes: dto.sizeBytes || 0,
      metadata: {
        ...(dto.metadata || {}),
        directS3Upload: true,
        textureType: dto.textureType,
      },
    });

    const saved = await this.mediaRepo.save(asset);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: userId || null,
        action: 'MEDIA_ASSET_DIRECT_CONFIRMED',
        details: {
          assetId: saved.id,
          title: saved.title,
          mediaType: saved.mediaType,
        },
      }),
    );

    return saved;
  }

  /**
   * Verifica dependencias activas antes de permitir la eliminación o retiro (Regla HU-033)
   */
  async verifyDependencies(id: string): Promise<{
    canDelete: boolean;
    activeDependencies: string[];
    warningMessage?: string;
    asset: MediaAsset;
  }> {
    const asset = await this.getMediaById(id);
    const deps = asset.usedByComponents || [];
    const hasActiveDeps = asset.isActive && deps.length > 0;

    return {
      canDelete: !hasActiveDeps,
      activeDependencies: deps,
      warningMessage: hasActiveDeps
        ? `El recurso está siendo utilizado por ${deps.length} componente(s) activo(s): ${deps.join(', ')}. No debe eliminarse sin antes desvincular estas dependencias.`
        : undefined,
      asset,
    };
  }

  /**
   * Elimina un recurso del sistema con verificación estricta de dependencias
   */
  async deleteMedia(
    id: string,
    force: boolean = false,
    user?: any,
  ): Promise<{ success: boolean; message: string }> {
    const { canDelete, activeDependencies, asset } = await this.verifyDependencies(id);

    // Regla de negocio HU-033: Un recurso utilizado por un componente activo no debe eliminarse sin verificar sus dependencias.
    if (!canDelete && !force) {
      throw new ConflictException(
        `Acción bloqueada: El recurso "${asset.title}" no puede eliminarse porque está siendo utilizado activamente por: ${activeDependencies.join(', ')}. Para retirarlo del sistema, primero desvincula las dependencias o solicita un retiro forzado con autorización de administrador.`,
      );
    }

    // 1. Eliminar archivo en S3
    await this.storageService.deleteFile(asset.s3Key);

    // 2. Eliminar de la base de datos
    await this.mediaRepo.remove(asset);

    // 3. Registrar en auditoría
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: user?.id || null,
        action: force ? 'MEDIA_ASSET_FORCE_DELETED' : 'MEDIA_ASSET_DELETED',
        details: {
          assetId: id,
          title: asset.title,
          mediaType: asset.mediaType,
          hadDependencies: activeDependencies,
          deletedBy: user?.email || 'authorized_admin',
        },
      }),
    );

    return {
      success: true,
      message: `El recurso "${asset.title}" ha sido retirado y eliminado exitosamente del sistema S3.`,
    };
  }

  /**
   * Retira de forma segura un recurso del sistema (marca como 'retired' e inactivo)
   */
  async retireMedia(id: string, user?: any): Promise<MediaAsset> {
    const asset = await this.getMediaById(id);
    asset.status = 'retired';
    asset.isActive = false;
    const updated = await this.mediaRepo.save(asset);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: user?.id || null,
        action: 'MEDIA_ASSET_RETIRED',
        details: {
          assetId: asset.id,
          title: asset.title,
          retiredBy: user?.email || 'authorized_admin',
        },
      }),
    );

    return updated;
  }

  /**
   * Listar recursos con filtros por tipo, función de plataforma y búsqueda
   */
  async listMedia(
    type?: MediaType | 'all',
    functionTag?: SystemFunction | 'all',
    search?: string,
    page: number = 1,
    limit: number = 50,
    ownerId?: string,
  ): Promise<{ data: MediaAsset[]; total: number; page: number; totalPages: number }> {
    const query = this.mediaRepo.createQueryBuilder('media');

    if (ownerId) {
      query.andWhere('media.userId = :ownerId', { ownerId });
    }

    if (type && type !== 'all') {
      query.andWhere('media.mediaType = :type', { type });
    }

    if (functionTag && functionTag !== 'all') {
      query.andWhere('media.systemFunction = :functionTag', { functionTag });
    }

    if (search && search.trim() !== '') {
      query.andWhere(
        '(LOWER(media.title) LIKE :search OR LOWER(media.originalFilename) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    query.orderBy('media.createdAt', 'DESC');
    query.skip((page - 1) * limit);
    query.take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Obtener detalle de un recurso por ID
   */
  async getMediaById(id: string): Promise<MediaAsset> {
    const asset = await this.mediaRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Elemento multimedia no encontrado (ID: ${id})`);
    }
    return asset;
  }

  /**
   * Estadísticas de supervisión de recursos multimedia y modelos
   */
  async getStorageStats() {
    const assets = await this.mediaRepo.find();

    let totalBytes = 0;
    let photosCount = 0;
    let garmentsCount = 0;
    let modelsCount = 0;
    let aiComponentsCount = 0;
    let texturesCount = 0;
    let activeWithDependenciesCount = 0;

    for (const a of assets) {
      const bytes = Number(a.sizeBytes) || 0;
      totalBytes += bytes;

      if (a.mediaType === 'photo') photosCount++;
      else if (a.mediaType === 'garment') garmentsCount++;
      else if (a.mediaType === 'model_3d') modelsCount++;
      else if (a.mediaType === 'ai_component') aiComponentsCount++;
      else if (a.mediaType === 'texture') texturesCount++;

      if (a.isActive && a.usedByComponents && a.usedByComponents.length > 0) {
        activeWithDependenciesCount++;
      }
    }

    const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
    const storageInfo = this.storageService.getStatus();

    return {
      totalAssets: assets.length,
      totalStorageBytes: totalBytes,
      totalStorageFormatted: `${totalMb} MB`,
      breakdown: {
        photos: photosCount,
        garments: garmentsCount,
        models3d: modelsCount,
        aiComponents: aiComponentsCount,
        textures: texturesCount,
      },
      supervision: {
        activeWithDependencies: activeWithDependenciesCount,
        protectedFromDeletion: activeWithDependenciesCount,
        totalSupervised: assets.length,
      },
      cdnStatus: {
        provider: storageInfo.provider,
        bucket: storageInfo.bucket,
        region: storageInfo.region,
        cdnBaseUrl: storageInfo.cdnBaseUrl,
        // Estado real según la configuración (antes eran textos y un 84,6 % fijos que nada medía)
        edgeCaching: storageInfo.edgeCachingEnabled
          ? 'Activa (CDN configurada)'
          : storageInfo.usesS3
            ? 'Sin CDN: se sirve directo del bucket'
            : 'Sin CDN: almacenamiento local',
        cacheTtl: storageInfo.usesS3 ? '1 año (inmutable)' : 'Sin caché (servidor local)',
        corsEnabled: true,
      },
    };
  }
}
