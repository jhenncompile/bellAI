import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { resolveJwtSecret } from '../../../config/jwt.config';
import { touchLastSeen } from '../../../common/activity/last-seen';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config.get<string>('JWT_SECRET')),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['profile', 'preferences'],
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Usuario inactivo o no autorizado');
    }

    // HU-30: actividad reciente para el panel (sin esperar ni frenar la petición)
    void touchLastSeen((sql, params) => this.userRepository.query(sql, params as any[]), user.id);
    return user;
  }
}
