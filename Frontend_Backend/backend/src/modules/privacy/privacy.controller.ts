import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrivacyService } from './privacy.service';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ConfirmDataDeletionDto } from './dto/confirm-data-deletion.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  /**
   * Endpoint para descargar el archivo JSON de portabilidad de datos GDPR
   */
  @Get('export')
  async exportData(@CurrentUser() user: User, @Req() req: Request, @Res() res: Response) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const data = await this.privacyService.exportUserData(user.id, origin);
    const filename = `mis_datos_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(data, null, 2));
  }

  /** Resumen de la información asociada a la cuenta autenticada. */
  @Get('data-summary')
  async getDataOverview(@CurrentUser() user: User) {
    return this.privacyService.getDataOverview(user.id);
  }

  /**
   * Endpoint para solicitar la supresión definitiva de la cuenta y sus datos.
   */
  @Post('right-to-be-forgotten')
  async rightToBeForgotten(
    @CurrentUser() user: User,
    @Body() dto: ConfirmDataDeletionDto,
  ) {
    if (dto.confirm !== true) {
      throw new BadRequestException('Confirma la eliminación para continuar.');
    }
    return this.privacyService.rightToBeForgotten(user.id, dto.reason, dto.password);
  }

  /**
   * Obtener consentimientos del usuario
   */
  @Get('consents')
  async getConsents(@CurrentUser() user: User) {
    return this.privacyService.getConsents(user.id);
  }

  /**
   * Registrar o actualizar un consentimiento
   */
  @Post('consents')
  async recordConsent(
    @CurrentUser() user: User,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.privacyService.recordConsent(user.id, dto, clientIp, userAgent);
  }

  /**
   * Obtener registro de auditoría de privacidad
   */
  @Get('audit-logs')
  async getAuditLogs(@CurrentUser() user: User) {
    return this.privacyService.getAuditLogs(user.id);
  }
}
