import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset } from './entities/media-asset.entity';
import { AuditLog } from '../privacy/entities/audit-log.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { StorageModule } from '../storage/storage.module';
import { AdminModule } from '../admin/admin.module';
import { StorageMonitorService } from './storage-monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, AuditLog]),
    StorageModule,
    AdminModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, StorageMonitorService],
  exports: [MediaService, StorageMonitorService],
})
export class MediaModule {}
