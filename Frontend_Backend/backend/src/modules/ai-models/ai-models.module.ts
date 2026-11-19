import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MediaModule } from '../media/media.module';
import { AiModelsController } from './ai-models.controller';
import { AiModelsService } from './ai-models.service';

@Module({
  imports: [AdminModule, MediaModule],
  controllers: [AiModelsController],
  providers: [AiModelsService],
  exports: [AiModelsService],
})
export class AiModelsModule {}
