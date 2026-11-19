import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { User } from '../users/entities/user.entity';
import { Profile } from './entities/profile.entity';
import { Preferences } from './entities/preferences.entity';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Preferences, AuditLog]),
    UploadModule,
    CacheModule.register({
      ttl: 300000, // 5 min default
    }),
  ],
  controllers: [ProfileController],
  providers: [ProfileService, CryptoService],
  exports: [ProfileService],
})
export class ProfileModule {}
