import { Injectable, NotFoundException, Inject, ConflictException, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Profile } from './entities/profile.entity';
import { Preferences } from './entities/preferences.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly cryptoService: CryptoService,
    private readonly uploadService: UploadService,
  ) {}

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const previousProfile = await this.profileRepository.findOne({ where: { userId } });
    const uploaded = await this.uploadService.processAndSaveAvatar(file);
    try {
      await this.updateProfile(userId, { avatarUrl: uploaded.url });
    } catch (error) {
      await this.uploadService.deleteAvatar(uploaded.url).catch((cleanupError) => {
        this.logger.warn(`No se pudo limpiar el avatar recién subido: ${String(cleanupError)}`);
      });
      throw error;
    }
    if (previousProfile?.avatarUrl && previousProfile.avatarUrl !== uploaded.url) {
      await this.uploadService.deleteAvatar(previousProfile.avatarUrl).catch((error) => {
        this.logger.warn(`No se pudo limpiar el avatar anterior: ${String(error)}`);
      });
    }
    return { avatarUrl: uploaded.url, size: uploaded.size };
  }

  async invalidateProfileCache(userId: string): Promise<void> {
    await this.cacheManager.del(`user_profile:${userId}`);
  }

  /**
   * Obtiene el perfil completo con caché inteligente (TTL 5 minutos).
   */
  async getProfile(userId: string) {
    const cacheKey = `user_profile:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'preferences'],
    });

    if (!user) {
      throw new NotFoundException('Perfil de usuario no encontrado');
    }

    // Asegurar que existan perfil y preferencias
    let profile = user.profile;
    if (!profile) {
      profile = this.profileRepository.create({
        userId: user.id,
        bio: '',
        phoneMasked: '',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`,
      });
      profile = await this.profileRepository.save(profile);
    }

    let preferences = user.preferences;
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId: user.id,
        theme: 'system',
        language: 'es',
        emailNotifications: true,
        pushNotifications: true,
      });
      preferences = await this.preferencesRepository.save(preferences);
    }

    // Descifrar campos sensibles para el usuario dueño de la sesión
    const decryptedPhone = profile.phoneEncrypted
      ? this.cryptoService.decrypt(profile.phoneEncrypted)
      : '';
    const decryptedAddress = profile.addressEncrypted
      ? this.cryptoService.decrypt(profile.addressEncrypted)
      : '';

    const result = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      profile: {
        id: profile.id,
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        phone: decryptedPhone,
        phoneMasked: profile.phoneMasked || this.cryptoService.maskPhone(decryptedPhone),
        address: decryptedAddress,
        birthDate: profile.birthDate || '',
      },
      preferences: {
        id: preferences.id,
        theme: preferences.theme,
        language: preferences.language,
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
        marketingConsent: preferences.marketingConsent,
        trackingConsent: preferences.trackingConsent,
        autoBackupEnabled: preferences.autoBackupEnabled ?? true,
        offlineModeEnabled: preferences.offlineModeEnabled ?? true,
        lastSyncedAt: preferences.lastSyncedAt ?? preferences.updatedAt ?? null,
        stylePreferences: preferences.stylePreferences || {},
      },
    };

    // Guardar en caché
    await this.cacheManager.set(cacheKey, result, 300000); // 5 min
    return result;
  }

  /**
   * Actualiza el perfil de usuario e invalida la caché.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userRepository.manager.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const profiles = manager.getRepository(Profile);
      const auditLogs = manager.getRepository(AuditLog);
      const user = await users.findOne({ where: { id: userId }, relations: ['profile'] });
      if (!user) throw new NotFoundException('Usuario no encontrado');

      const changedFields: string[] = [];
      if (dto.name?.trim() && dto.name.trim() !== user.name) {
        user.name = dto.name.trim();
        changedFields.push('name');
      }
      if (dto.email?.trim()) {
        const email = dto.email.trim().toLowerCase();
        if (email !== user.email.toLowerCase()) {
          const emailOwner = await users.findOne({ where: { email } });
          if (emailOwner && emailOwner.id !== user.id) {
            throw new ConflictException('Ese correo ya está asociado a otra cuenta.');
          }
          user.email = email;
          changedFields.push('email');
        }
      }
      if (changedFields.includes('name') || changedFields.includes('email')) {
        await users.save(user);
      }

      const profile = user.profile || profiles.create({ userId: user.id });
      if (dto.bio !== undefined) {
        profile.bio = dto.bio;
        changedFields.push('bio');
      }
      if (dto.avatarUrl !== undefined) {
        profile.avatarUrl = dto.avatarUrl;
        changedFields.push('avatarUrl');
      }
      if (dto.birthDate !== undefined) {
        profile.birthDate = dto.birthDate || null;
        changedFields.push('birthDate');
      }
      if (dto.phone !== undefined) {
        if (dto.phone.trim()) {
          profile.phoneEncrypted = this.cryptoService.encrypt(dto.phone.trim());
          profile.phoneMasked = this.cryptoService.maskPhone(dto.phone.trim());
        } else {
          profile.phoneEncrypted = '';
          profile.phoneMasked = '';
        }
        changedFields.push('phone');
      }
      if (dto.address !== undefined) {
        profile.addressEncrypted = dto.address.trim()
          ? this.cryptoService.encrypt(dto.address.trim())
          : '';
        changedFields.push('address');
      }

      await profiles.save(profile);
      if (changedFields.length > 0) {
        await auditLogs.save(auditLogs.create({
          userId,
          action: 'PROFILE_UPDATED',
          entityType: 'profile',
          entityId: userId,
          details: { changedFields },
          success: true,
          ipAddress: null,
        }));
      }
    });

    // Invalidar caché
    await this.invalidateProfileCache(userId);

    return this.getProfile(userId);
  }

  /**
   * Actualiza las preferencias del usuario e invalida la caché.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.userRepository.manager.transaction(async (manager) => {
      const preferencesRepository = manager.getRepository(Preferences);
      const auditLogs = manager.getRepository(AuditLog);
      let preferences = await preferencesRepository.findOne({ where: { userId } });
      if (!preferences) preferences = preferencesRepository.create({ userId });

      if (dto.theme !== undefined) preferences.theme = dto.theme;
      if (dto.language !== undefined) preferences.language = dto.language;
      if (dto.emailNotifications !== undefined) preferences.emailNotifications = dto.emailNotifications;
      if (dto.pushNotifications !== undefined) preferences.pushNotifications = dto.pushNotifications;
      if (dto.marketingConsent !== undefined) preferences.marketingConsent = dto.marketingConsent;
      if (dto.trackingConsent !== undefined) preferences.trackingConsent = dto.trackingConsent;
      if (dto.autoBackupEnabled !== undefined) preferences.autoBackupEnabled = dto.autoBackupEnabled;
      if (dto.offlineModeEnabled !== undefined) preferences.offlineModeEnabled = dto.offlineModeEnabled;
      if (dto.stylePreferences !== undefined) {
        preferences.stylePreferences = {
          ...(preferences.stylePreferences || {}),
          ...dto.stylePreferences,
        };
      }
      preferences.lastSyncedAt = new Date();

      await preferencesRepository.save(preferences);
      await auditLogs.save(auditLogs.create({
        userId,
        action: 'PROFILE_PREFERENCES_UPDATED',
        entityType: 'preferences',
        entityId: userId,
        details: { changedFields: Object.keys(dto) },
        success: true,
        ipAddress: null,
      }));
    });

    // Invalidar caché
    await this.invalidateProfileCache(userId);

    return this.preferencesRepository.findOne({ where: { userId } });
  }
}
