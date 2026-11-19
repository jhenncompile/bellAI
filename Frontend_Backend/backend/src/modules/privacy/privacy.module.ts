import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { GdprConsent } from './entities/gdpr-consent.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CryptoService } from '../../common/crypto/crypto.service';
import { WardrobeItem } from '../wardrobe/entities/wardrobe-item.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { WardrobeModule } from '../wardrobe/wardrobe.module';
import { ProfileModule } from '../profile/profile.module';
import { PhotoAnalysisConsentModule } from './photo-analysis-consent.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Preferences,
      GdprConsent,
      AuditLog,
      WardrobeItem,
      MediaAsset,
    ]),
    WardrobeModule,
    ProfileModule,
    PhotoAnalysisConsentModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService, CryptoService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
