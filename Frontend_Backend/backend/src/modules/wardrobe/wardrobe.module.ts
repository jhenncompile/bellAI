import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WardrobeItem } from './entities/wardrobe-item.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { BellaiDiagnostic } from '../bellai/entities/bellai-diagnostic.entity';
import { WardrobeController } from './wardrobe.controller';
import { WardrobeService } from './wardrobe.service';
import { WardrobeEnhancementService } from './wardrobe-enhancement.service';
import { OutfitGeneratorService } from './outfit-generator.service';
import { StoreGarmentEvaluatorService } from './store-garment-evaluator.service';
import { PhotoAnalysisConsentModule } from '../privacy/photo-analysis-consent.module';
import { OutfitsModule } from '../outfits/outfits.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WardrobeItem,
      AuditLog,
      User,
      Profile,
      Preferences,
      BellaiDiagnostic,
    ]),
    PhotoAnalysisConsentModule,
    OutfitsModule,
    SubscriptionsModule,
  ],
  controllers: [WardrobeController],
  providers: [
    WardrobeService,
    WardrobeEnhancementService,
    OutfitGeneratorService,
    StoreGarmentEvaluatorService,
  ],
  exports: [
    WardrobeService,
    WardrobeEnhancementService,
    OutfitGeneratorService,
    StoreGarmentEvaluatorService,
  ],
})
export class WardrobeModule {}
