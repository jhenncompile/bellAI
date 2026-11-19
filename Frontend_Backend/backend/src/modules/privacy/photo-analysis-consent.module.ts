import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprConsent } from './entities/gdpr-consent.entity';
import { PhotoAnalysisConsentService } from './photo-analysis-consent.service';

@Module({
  imports: [TypeOrmModule.forFeature([GdprConsent])],
  providers: [PhotoAnalysisConsentService],
  exports: [PhotoAnalysisConsentService],
})
export class PhotoAnalysisConsentModule {}
