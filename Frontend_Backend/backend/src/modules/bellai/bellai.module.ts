import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { WardrobeItem } from '../wardrobe/entities/wardrobe-item.entity';
import { GdprConsent } from '../privacy/entities/gdpr-consent.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { BellaiDiagnostic } from './entities/bellai-diagnostic.entity';
import { BellaiOutfit } from './entities/bellai-outfit.entity';
import { BellaiConversation } from './entities/bellai-conversation.entity';
import { BellaiMessage } from './entities/bellai-message.entity';
import { BellaiContextBuilder } from './bellai-context.builder';
import { BellaiRecommendationReasoner } from './bellai-recommendation.reasoner';
import { BellaiAdvisorClient } from './bellai-advisor.client';
import { BellaiService } from './bellai.service';
import { BellaiController } from './bellai.controller';
import { VisionController } from './vision.controller';

@Module({
  imports: [
    AdminModule,
    TypeOrmModule.forFeature([
      BellaiDiagnostic,
      BellaiOutfit,
      BellaiConversation,
      BellaiMessage,
      User,
      Profile,
      Preferences,
      WardrobeItem,
      GdprConsent,
      AuditLog,
    ]),
  ],
  controllers: [BellaiController, VisionController],
  providers: [
    BellaiContextBuilder,
    BellaiRecommendationReasoner,
    BellaiAdvisorClient,
    BellaiService,
  ],
  exports: [BellaiService, BellaiContextBuilder, BellaiRecommendationReasoner],
})
export class BellaiModule {}
