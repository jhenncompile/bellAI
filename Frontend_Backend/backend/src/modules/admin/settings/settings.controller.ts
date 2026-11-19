import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PlatformSettingsService } from './settings.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/settings')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  @Get()
  async getSettings() {
    const settings = await this.settingsService.getAllSettings();
    return { settings };
  }

  @Patch(':key')
  async updateSetting(
    @Param('key') key: string,
    @Body('value') value: unknown,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const setting = await this.settingsService.updateSetting(
      key,
      value,
      user.id,
      clientIp,
    );
    return { setting };
  }
}
