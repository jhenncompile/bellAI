import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { PlatformSetting } from './entities/platform-setting.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';

import { PlatformSettingsService } from './settings/settings.service';
import { PlatformSettingsController } from './settings/settings.controller';

import { AdminAuditService } from './audit/audit.service';
import { AdminAuditController } from './audit/audit.controller';

import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSetting, AuditLog, User, MediaAsset]),
    ConfigModule,
  ],
  controllers: [
    PlatformSettingsController,
    AdminAuditController,
    DashboardController,
  ],
  providers: [
    PlatformSettingsService,
    AdminAuditService,
    DashboardService,
  ],
  exports: [
    PlatformSettingsService,
    AdminAuditService,
    DashboardService,
  ],
})
export class AdminModule {}
