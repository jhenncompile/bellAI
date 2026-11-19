import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GdprConsent } from './entities/gdpr-consent.entity';

export const PHOTO_ANALYSIS_CONSENT_TYPE = 'photo_analysis';
export const PHOTO_ANALYSIS_CONSENT_ERROR = 'PHOTO_ANALYSIS_CONSENT_REQUIRED';

@Injectable()
export class PhotoAnalysisConsentService {
  constructor(
    @InjectRepository(GdprConsent)
    private readonly consentRepository: Repository<GdprConsent>,
  ) {}

  async assertPhotoAnalysisConsent(userId: string): Promise<void> {
    try {
      const latestConsent = await this.consentRepository.findOne({
        where: {
          userId,
          consentType: PHOTO_ANALYSIS_CONSENT_TYPE,
        },
        order: { createdAt: 'DESC' },
      });

      if (latestConsent?.accepted === true) return;
    } catch {
      // Ante una consulta fallida se aplica denegación por defecto.
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: PHOTO_ANALYSIS_CONSENT_ERROR,
      message:
        'Necesitas autorizar el análisis de fotografías desde Privacidad y datos antes de continuar.',
    });
  }
}
