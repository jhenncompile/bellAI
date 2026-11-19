import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BellaiModule } from '../bellai/bellai.module';
import { StorageModule } from '../storage/storage.module';
import { DiagnosisController, VisionCompatController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';

@Module({
  imports: [AdminModule, BellaiModule, StorageModule],
  controllers: [DiagnosisController, VisionCompatController],
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
