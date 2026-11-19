import { Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { GdprConsent } from './entities/gdpr-consent.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AsyncQueueService } from '../queues/async-queue.service';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { WardrobeItem } from '../wardrobe/entities/wardrobe-item.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { StorageService } from '../storage/storage.service';
import { WardrobeEnhancementService } from '../wardrobe/wardrobe-enhancement.service';
import { ProfileService } from '../profile/profile.service';
import { signMediaPath } from '../../common/media/signed-url';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    @InjectRepository(GdprConsent)
    private readonly consentRepository: Repository<GdprConsent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(WardrobeItem)
    private readonly wardrobeRepository: Repository<WardrobeItem>,
    @InjectRepository(MediaAsset)
    private readonly mediaRepository: Repository<MediaAsset>,
    private readonly cryptoService: CryptoService,
    private readonly asyncQueueService: AsyncQueueService,
    private readonly storageService: StorageService,
    private readonly wardrobeEnhancementService: WardrobeEnhancementService,
    private readonly profileService: ProfileService,
  ) {}

  /** Devuelve un inventario legible de los datos asociados a la cuenta autenticada. */
  async getDataOverview(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'preferences'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const [wardrobeItems, mediaCount, consentCount] = await Promise.all([
      this.wardrobeRepository.find({ where: { userId } }),
      this.mediaRepository.count({ where: { userId } }),
      this.consentRepository.count({ where: { userId } }),
    ]);
    const wardrobePhotoCount = wardrobeItems.reduce(
      (count, item) => count + Number(Boolean(item.originalImageUrl)) + Number(Boolean(item.enhancedImageUrl)),
      0,
    );
    const phone = user.profile?.phoneEncrypted
      ? this.cryptoService.decrypt(user.profile.phoneEncrypted)
      : '';
    const address = user.profile?.addressEncrypted
      ? this.cryptoService.decrypt(user.profile.addressEncrypted)
      : '';

    await this.auditLogRepository.save(this.auditLogRepository.create({
      userId,
      action: 'GDPR_DATA_OVERVIEW',
      entityType: 'privacy_data_summary',
      details: { viewed: true },
      success: true,
      ipAddress: null,
    }));

    return {
      account: { name: user.name, email: user.email, memberSince: user.createdAt },
      profile: {
        bio: user.profile?.bio || '',
        phone,
        address,
        birthDate: user.profile?.birthDate || '',
        avatarUrl: user.profile?.avatarUrl && !user.profile.avatarUrl.includes('dicebear.com')
          ? user.profile.avatarUrl
          : '',
      },
      preferences: {
        theme: user.preferences?.theme || 'system',
        language: user.preferences?.language || 'es',
        emailNotifications: user.preferences?.emailNotifications ?? true,
        pushNotifications: user.preferences?.pushNotifications ?? true,
        marketingConsent: user.preferences?.marketingConsent ?? false,
        trackingConsent: user.preferences?.trackingConsent ?? false,
        stylePreferences: user.preferences?.stylePreferences || {},
      },
      wardrobe: {
        itemCount: wardrobeItems.length,
        items: wardrobeItems.map((item) => ({
          name: item.name,
          category: item.category,
          addedAt: item.createdAt,
        })),
      },
      photos: {
        wardrobeCount: wardrobePhotoCount,
        mediaCount,
        totalCount: wardrobePhotoCount + mediaCount + Number(Boolean(user.profile?.avatarUrl && !user.profile.avatarUrl.includes('dicebear.com'))),
      },
      consents: { recordCount: consentCount },
      analysis: await this.bellaiCounts(userId),
    };
  }

  /** Recuento de datos del asistente para la pantalla de privacidad (HU-029). */
  private async bellaiCounts(userId: string) {
    const [row] = await this.userRepository.manager.query(
      `SELECT (SELECT COUNT(*) FROM diagnostico WHERE usuario_id = $1)::int AS diagnostics,
              (SELECT COUNT(*) FROM fotografia WHERE usuario_id = $1)::int AS "storedPhotos",
              (SELECT COUNT(*) FROM conversacion WHERE usuario_id = $1)::int AS conversations,
              (SELECT COUNT(*) FROM outfit WHERE usuario_id = $1)::int AS outfits,
              (SELECT COUNT(*) FROM retroalimentacion WHERE usuario_id = $1)::int AS feedback,
              (SELECT COUNT(*) FROM simulacion WHERE usuario_id = $1)::int AS simulations`,
      [userId],
    ).catch(() => [null]);
    return row || { diagnostics: 0, storedPhotos: 0, conversations: 0, outfits: 0, feedback: 0, simulations: 0 };
  }

  /**
   * Genera el paquete de exportación de datos del usuario bajo el Art. 20 del GDPR (Portabilidad de Datos).
   */
  async exportUserData(userId: string, requestOrigin: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'preferences', 'consents'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const [wardrobeItems, mediaAssets] = await Promise.all([
      this.wardrobeRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.mediaRepository.find({ where: { userId }, order: { createdAt: 'ASC' } }),
    ]);

    const decryptedPhone = user.profile?.phoneEncrypted
      ? this.cryptoService.decrypt(user.profile.phoneEncrypted)
      : '';
    const decryptedAddress = user.profile?.addressEncrypted
      ? this.cryptoService.decrypt(user.profile.addressEncrypted)
      : '';

    const exportPackage = {
      exportMetadata: {
        exportTimestamp: new Date().toISOString(),
        regulations: 'Reglamento General de Protección de Datos (RGPD / GDPR) - Art. 20',
        platform: 'Sistema Bellia',
        dataSubjectId: user.id,
      },
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        memberSince: user.createdAt,
      },
      profile: {
        bio: user.profile?.bio || '',
        phone: decryptedPhone,
        address: decryptedAddress,
        birthDate: user.profile?.birthDate || null,
        avatarUrl: user.profile?.avatarUrl || '',
      },
      preferences: {
        theme: user.preferences?.theme || 'system',
        language: user.preferences?.language || 'es',
        emailNotifications: user.preferences?.emailNotifications ?? true,
        pushNotifications: user.preferences?.pushNotifications ?? true,
        marketingConsent: user.preferences?.marketingConsent ?? false,
        trackingConsent: user.preferences?.trackingConsent ?? false,
        autoBackupEnabled: user.preferences?.autoBackupEnabled ?? true,
        offlineModeEnabled: user.preferences?.offlineModeEnabled ?? true,
        stylePreferences: user.preferences?.stylePreferences || {},
      },
      wardrobe: wardrobeItems.map((item) => ({
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        color: item.color,
        colorHex: item.colorHex,
        approximateSize: item.approximateSize,
        season: item.season,
        occasion: item.occasion,
        status: item.status,
        addedAt: item.createdAt,
        originalPhotoUrl: this.toAbsoluteUrl(signMediaPath(item.originalImageUrl, 7 * 24 * 3600), requestOrigin),
        enhancedPhotoUrl: this.toAbsoluteUrl(signMediaPath(item.enhancedImageUrl, 7 * 24 * 3600), requestOrigin),
      })),
      photos: {
        profileAvatar: user.profile?.avatarUrl || null,
        mediaAssets: await Promise.all(mediaAssets.map(async (asset) => ({
          title: asset.title,
          fileName: asset.originalFilename,
          mimeType: asset.mimeType,
          sizeBytes: Number(asset.sizeBytes),
          downloadUrl: await this.resolveMediaDownloadUrl(asset.s3Key, requestOrigin),
          createdAt: asset.createdAt,
        }))),
      },
      bellai: await this.exportBellaiData(userId),
      consentsHistory: (user.consents || []).map((c) => ({
        consentType: c.consentType,
        accepted: c.accepted,
        policyVersion: c.policyVersion,
        recordedAt: c.createdAt,
      })),
    };

    // Registrar en auditoría de forma asíncrona mediante la cola de tareas
    this.asyncQueueService.enqueueJob('AUDIT_LOG_PERSIST', { userId, action: 'GDPR_DATA_EXPORT' }, async () => {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          userId,
          action: 'GDPR_DATA_EXPORT',
          details: { message: 'El usuario descargó una copia completa de sus datos personales' },
        }),
      );
    });

    return exportPackage;
  }

  /** HU-029: datos del asistente (diagnósticos, Style DNA, outfits, chat, feedback, incidencias). */
  private async exportBellaiData(userId: string) {
    const q = (sql: string) => this.userRepository.manager.query(sql, [userId]).catch(() => []);
    const [diagnostics, styleDna, outfits, conversations, feedback, simulations, incidents, photos] = await Promise.all([
      q(`SELECT creado_en AS "createdAt", forma_rostro AS "faceShape", tono_piel AS "skinTone", subtono_piel AS undertone,
                paleta_estacional AS season, tipo_cuerpo AS "bodyType", resumen AS summary, resultado_detallado AS details
         FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en`),
      q(`SELECT dimensiones AS dimensions, fuentes AS sources, actualizado_en AS "updatedAt" FROM perfil_dna WHERE usuario_id = $1`),
      q(`SELECT titulo AS title, explicacion AS explanation, clima_resumen AS weather, valoracion AS rating, detalles AS details, creado_en AS "createdAt"
         FROM outfit WHERE usuario_id = $1 ORDER BY creado_en`),
      q(`SELECT c.titulo AS title, c.creada_en AS "createdAt",
                COALESCE(json_agg(json_build_object('sender', m.emisor, 'content', m.contenido, 'at', m.creado_en) ORDER BY m.creado_en)
                  FILTER (WHERE m.id IS NOT NULL), '[]') AS messages
         FROM conversacion c LEFT JOIN mensaje m ON m.conversacion_id = c.id WHERE c.usuario_id = $1 GROUP BY c.id ORDER BY c.creada_en`),
      q(`SELECT objetivo_tipo AS "targetType", objetivo_id AS "targetId", valor AS value, creado_en AS "createdAt" FROM retroalimentacion WHERE usuario_id = $1`),
      q(`SELECT tipo AS type, opciones AS options, creada_en AS "createdAt" FROM simulacion WHERE usuario_id = $1`),
      q(`SELECT tipo AS type, titulo AS title, descripcion AS description, estado AS status, creada_en AS "createdAt" FROM incidencia WHERE usuario_id = $1`),
      q(`SELECT tipo AS type, mime, tamano_bytes AS "sizeBytes", creada_en AS "createdAt" FROM fotografia WHERE usuario_id = $1`),
    ]);
    return { diagnostics, styleDna: styleDna[0] || null, outfits, conversations, feedback, simulations, incidents, storedPhotos: photos };
  }

  /**
   * Implementa el Derecho al Olvido (Art. 17 GDPR - Derecho de Supresión).
   * Elimina de forma irreversible la cuenta y sus datos personales.
   */
  async rightToBeForgotten(userId: string, reason?: string, password?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // CP-029-03: confirmación con la contraseña actual antes de borrar nada
    const withPassword = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!password || !(await bcrypt.compare(password, withPassword?.password || ''))) {
      throw new UnauthorizedException('La contraseña no es correcta. No se eliminó ningún dato.');
    }

    const [wardrobeItems, mediaAssets] = await Promise.all([
      this.wardrobeRepository.find({ where: { userId } }),
      this.mediaRepository.find({ where: { userId } }),
    ]);

    // Fotos privadas de diagnóstico, simulaciones y avatar (tabla fotografia)
    const privatePhotos: { key: string }[] = await this.userRepository.manager
      .query('SELECT clave_archivo AS key FROM fotografia WHERE usuario_id = $1', [userId])
      .catch(() => []);
    // Malla del avatar escaneado (HU-023): lleva los colores de la cara
    const [scanMesh]: { key: string | null }[] = await this.userRepository.manager
      .query(`SELECT configuracion->'scan'->>'key' AS key FROM avatar WHERE usuario_id = $1`, [userId])
      .catch(() => []);
    if (scanMesh?.key) privatePhotos.push({ key: scanMesh.key });

    try {
      await Promise.all(mediaAssets.map((asset) => this.storageService.deleteFile(asset.s3Key)));
      await Promise.all(privatePhotos.map((p) => this.storageService.deleteFile(p.key)));
      await this.wardrobeEnhancementService.removeGarmentImages(
        wardrobeItems.flatMap((item) => [item.originalImageUrl, item.enhancedImageUrl]),
      );
      const avatarKey = this.getAvatarStorageKey(user.profile?.avatarUrl);
      if (avatarKey) await this.storageService.deleteFile(avatarKey);
    } catch {
      // Mantener las filas para poder reintentar si el almacenamiento no pudo borrar una foto.
      throw new ServiceUnavailableException(
        'No se pudieron eliminar todas las fotografías. Inténtalo de nuevo más tarde.',
      );
    }

    await this.userRepository.manager.transaction(async (manager) => {
      await manager.getRepository(MediaAsset).delete({ userId });
      await manager.getRepository(WardrobeItem).delete({ userId });
      await manager.getRepository(Profile).delete({ userId });
      await manager.getRepository(Preferences).delete({ userId });
      await manager.getRepository(GdprConsent).delete({ userId });
      // Las tablas BellAI (usuario, diagnostico, fotografia, outfit, conversacion…) se eliminan en cascada
      // al borrar la cuenta (fk_usuario_users). Las incidencias se borran explícitamente.
      await manager.query('DELETE FROM incidencia WHERE usuario_id = $1', [userId]);
      await manager.query(
        `UPDATE audit_logs
         SET user_id = NULL, entity_id = NULL, ip_address = NULL, details = $1::jsonb
         WHERE user_id = $2`,
        [JSON.stringify({ redacted: true }), userId],
      );
      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          userId: null,
          action: 'RIGHT_TO_BE_FORGOTTEN_EXECUTED',
          entityType: 'privacy_request',
          entityId: null,
          details: { message: 'Se completó la eliminación de datos personales solicitada.' },
          success: true,
          ipAddress: null,
        }),
      );
      await manager.getRepository(User).delete({ id: userId });
    });

    await this.profileService.invalidateProfileCache(userId);

    return {
      message: 'Se eliminaron tus datos personales, preferencias, fotografías, análisis, conversaciones y prendas. Tu sesión se cerrará.',
      status: 'deleted',
    };
  }

  private toAbsoluteUrl(value: string | null, requestOrigin: string): string | null {
    if (!value) return null;
    const origin = requestOrigin.replace(/\/$/, '');
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
          return `${origin}${url.pathname}${url.search}${url.hash}`;
        }
      } catch {
        return value;
      }
      return value;
    }
    return `${origin}/${value.replace(/^\//, '')}`;
  }

  private async resolveMediaDownloadUrl(key: string, requestOrigin: string): Promise<string> {
    const url = await this.storageService.getPresignedDownloadUrl(key);
    return url.replace(/^http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/i, requestOrigin);
  }

  private getAvatarStorageKey(avatarUrl?: string | null): string | null {
    if (!avatarUrl) return null;
    try {
      const pathname = new URL(avatarUrl).pathname;
      const marker = '/avatars/';
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex < 0) return null;
      const key = pathname.slice(markerIndex + 1);
      return /^avatars\/avatar_[a-f0-9]{32}\.webp$/i.test(key) ? key : null;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene la lista de consentimientos otorgados o rechazados por el usuario.
   */
  async getConsents(userId: string) {
    return this.consentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Registra o actualiza el estado de un consentimiento GDPR.
   */
  async recordConsent(userId: string, dto: UpdateConsentDto, clientIp?: string, userAgent?: string) {
    const ipHash = clientIp ? this.cryptoService.hashAnonymize(clientIp) : null;

    const consent = this.consentRepository.create({
      userId,
      consentType: dto.consentType,
      accepted: dto.accepted,
      policyVersion: dto.policyVersion || 'v1.0',
      ipHash,
      userAgent: userAgent ? userAgent.slice(0, 250) : null,
    });

    const saved = await this.consentRepository.save(consent);

    // Sincronizar con preferencias si aplica
    if (dto.consentType === 'marketing_emails' || dto.consentType === 'marketing') {
      await this.preferencesRepository.update({ userId }, { marketingConsent: dto.accepted });
    } else if (dto.consentType === 'analytics_cookies' || dto.consentType === 'tracking') {
      await this.preferencesRepository.update({ userId }, { trackingConsent: dto.accepted });
    }

    return saved;
  }

  /**
   * Obtiene los logs de auditoría de privacidad del usuario.
   */
  async getAuditLogs(userId: string) {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
