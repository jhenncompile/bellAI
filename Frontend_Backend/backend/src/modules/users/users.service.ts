import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import { CreateUserDto, GetUsersQueryDto } from './dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

export { CreateUserDto, GetUsersQueryDto };

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  lastActive: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly settingsService: PlatformSettingsService,
  ) {}

  async findAll(query?: GetUsersQueryDto) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .orderBy('user.createdAt', 'DESC');

    if (query?.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(user.name ILIKE :term OR user.email ILIKE :term)', { term });
    }

    if (query?.role && query.role !== 'all' && query.role.trim()) {
      qb.andWhere('user.role = :role', { role: query.role.trim() });
    }

    if (query?.status && query.status !== 'all' && query.status.trim()) {
      qb.andWhere('user.status = :status', { status: query.status.trim() });
    }

    return qb.getMany();
  }

  async findAllAdmin(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.createAdminUserQuery();

    if (query.search) {
      qb.andWhere(
        '(POSITION(LOWER(:search) IN LOWER(user.name)) > 0 OR POSITION(LOWER(:search) IN LOWER(user.email)) > 0)',
        { search: query.search },
      );
    }
    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawAndEntities();

    return {
      data: entities.map((user, index) => this.toAdminUserView(user, raw[index]?.avatar)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOneForAdmin(id: string): Promise<AdminUserView> {
    const { entities, raw } = await this.createAdminUserQuery()
      .andWhere('user.id = :id', { id })
      .take(1)
      .getRawAndEntities();

    if (entities.length === 0) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toAdminUserView(entities[0], raw[0]?.avatar);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['profile', 'preferences'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async create(dto: CreateUserDto, actorUserId?: string) {
    const creationEnabled = await this.settingsService.getBoolean('user_creation_enabled');
    if (!creationEnabled) {
      throw new ConflictException({
        code: 'USER_CREATION_DISABLED',
        message: 'La creación administrativa de usuarios está deshabilitada temporalmente por la configuración de la plataforma.',
      });
    }

    if (!dto.email || !dto.name) {
      throw new BadRequestException('El nombre y el correo electrónico son obligatorios');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con este correo electrónico');
    }

    const rawPassword = dto.password || '123456789';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = this.userRepository.create({
      name: dto.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: dto.role || 'user',
      status: dto.status || 'active',
    });

    const savedUser = await this.userRepository.save(user);

    // Perfil inicial
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(savedUser.name)}`;
    const profile = this.profileRepository.create({
      userId: savedUser.id,
      bio: 'Usuario del Sistema Bellia',
      phoneMasked: '',
      avatarUrl,
    });
    await this.profileRepository.save(profile);

    // Preferencias iniciales
    const preferences = this.preferencesRepository.create({
      userId: savedUser.id,
      theme: 'system',
      language: 'es',
      emailNotifications: true,
      pushNotifications: true,
      marketingConsent: false,
      trackingConsent: false,
    });
    await this.preferencesRepository.save(preferences);

    // Registro de auditoría
    try {
      const auditLog = this.auditRepository.create({
        userId: actorUserId || undefined,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: savedUser.id,
        details: {
          role: savedUser.role,
          email: savedUser.email,
        },
        success: true,
      });
      await this.auditRepository.save(auditLog);
    } catch {
      // Ignorar fallos de auditoría no bloqueantes
    }

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      status: savedUser.status,
      avatar: avatarUrl,
      lastActive: 'Recién creado',
      createdAt: savedUser.createdAt,
    };
  }

  async updateStatus(
    id: string,
    status: 'active' | 'inactive' | 'suspended',
    actorUserId: string,
  ) {
    return this.userRepository.manager.transaction(async (manager) => {
      const { users, auditLogs, target, activeAdminCount } =
        await this.lockTargetAndAdministrators(manager, id, actorUserId);

      if (target.status === status) {
        return target;
      }
      if (
        target.role === 'admin' &&
        target.status === 'active' &&
        status !== 'active' &&
        activeAdminCount <= 1
      ) {
        throw new ConflictException('No se puede desactivar al último administrador activo');
      }
      if (target.id === actorUserId && status === 'suspended') {
        throw new ConflictException('No puedes suspender tu propia cuenta administrativa');
      }

      const previousStatus = target.status;
      target.status = status;
      const updated = await users.save(target);
      await auditLogs.save(
        auditLogs.create({
          userId: actorUserId,
          action: 'USER_STATUS_CHANGED',
          entityType: 'user',
          entityId: id,
          details: { previousStatus, newStatus: status },
          success: true,
        }),
      );

      return updated;
    });
  }

  async updateRole(id: string, role: 'admin' | 'manager' | 'user', actorUserId: string) {
    return this.userRepository.manager.transaction(async (manager) => {
      const { users, auditLogs, target, activeAdminCount } =
        await this.lockTargetAndAdministrators(manager, id, actorUserId);

      if (target.role === role) {
        return target;
      }
      if (
        target.role === 'admin' &&
        target.status === 'active' &&
        role !== 'admin' &&
        activeAdminCount <= 1
      ) {
        throw new ConflictException('No se puede degradar al último administrador activo');
      }
      if (target.id === actorUserId && target.role === 'admin' && role !== 'admin') {
        throw new ConflictException('No puedes quitarte tu propio rol de administrador');
      }

      const previousRole = target.role;
      target.role = role;
      const updated = await users.save(target);
      await auditLogs.save(
        auditLogs.create({
          userId: actorUserId,
          action: 'USER_ROLE_CHANGED',
          entityType: 'user',
          entityId: id,
          details: { previousRole, newRole: role },
          success: true,
        }),
      );

      return updated;
    });
  }

  async delete(id: string, actorUserId?: string) {
    if (actorUserId && id === actorUserId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta de administrador');
    }

    const user = await this.findOne(id);

    await this.userRepository.delete(user.id);

    try {
      const auditLog = this.auditRepository.create({
        userId: actorUserId || undefined,
        action: 'USER_DELETED',
        entityType: 'user',
        entityId: id,
        details: { deletedEmail: user.email, deletedRole: user.role },
        success: true,
      });
      await this.auditRepository.save(auditLog);
    } catch {
      // Ignorar fallos de auditoría no bloqueantes
    }

    return { success: true, message: 'Usuario eliminado exitosamente' };
  }

  private createAdminUserQuery(): SelectQueryBuilder<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.profile', 'profile')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.status',
        'user.createdAt',
      ])
      .addSelect('profile.avatarUrl', 'avatar');
  }

  private async lockTargetAndAdministrators(
    manager: EntityManager,
    targetId: string,
    actorUserId: string,
  ) {
    const users = manager.getRepository(User);
    const auditLogs = manager.getRepository(AuditLog);
    const lockedUsers = await users
      .createQueryBuilder('user')
      .where('(user.id = :targetId OR user.id = :actorUserId OR user.role = :adminRole)', {
        targetId,
        actorUserId,
        adminRole: 'admin',
      })
      .orderBy('user.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const target = lockedUsers.find((user) => user.id === targetId);
    const actor = lockedUsers.find((user) => user.id === actorUserId);

    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!actor || actor.role !== 'admin' || actor.status !== 'active') {
      throw new ForbiddenException('Solo un administrador activo puede realizar esta acción');
    }

    return {
      users,
      auditLogs,
      target,
      activeAdminCount: lockedUsers.filter(
        (user) => user.role === 'admin' && user.status === 'active',
      ).length,
    };
  }

  private toAdminUserView(user: User, avatar?: string): AdminUserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: avatar || undefined,
      lastActive: 'En línea',
      createdAt: user.createdAt,
    };
  }
}
