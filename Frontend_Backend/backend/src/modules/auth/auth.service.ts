import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { LoginDto } from './dto/login.dto';
import { touchLastSeen } from '../../common/activity/last-seen';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Preferences)
    private readonly preferencesRepository: Repository<Preferences>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: registerDto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Ya existe un usuario registrado con este correo electrónico');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      name: registerDto.name.trim(),
      email: registerDto.email.toLowerCase().trim(),
      password: hashedPassword,
      // El registro público siempre crea usuarias normales; los roles elevados
      // sólo se asignan desde POST /api/usuarios o PATCH /api/usuarios/:id/role (admin).
      role: 'user',
      status: 'active',
    });

    const savedUser = await this.userRepository.save(user);

    // Crear perfil por defecto
    const profile = this.profileRepository.create({
      userId: savedUser.id,
      bio: 'Nuevo usuario de Bellia',
      phoneMasked: '',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(savedUser.name)}`,
    });
    await this.profileRepository.save(profile);

    // Crear preferencias por defecto
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

    const token = this.generateToken(savedUser);

    return {
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        status: savedUser.status,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .where('user.email = :email', { email: loginDto.email.toLowerCase().trim() })
      .getOne();

    // Mismo mensaje si el correo no existe o la contraseña no coincide: no revela qué cuentas existen
    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password || '');
    if (!isMatch) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    // El estado de la cuenta sólo se informa a quien demostró conocer la contraseña
    if (user.status !== 'active') {
      throw new UnauthorizedException(
        'Tu cuenta está inactiva o suspendida. Escribe a soporte para reactivarla.',
      );
    }

    const token = this.generateToken(user);
    // HU-30: iniciar sesión siempre cuenta como actividad
    await touchLastSeen((sql, params) => this.userRepository.query(sql, params as any[]), user.id, true);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.profile?.avatarUrl,
        preferences: user.preferences,
      },
      token,
    };
  }

  async validateUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile', 'preferences'],
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }
}
