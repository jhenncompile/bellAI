import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BellaiModule } from '../bellai/bellai.module';
import { StyleController } from './style.controller';
import { StyleService } from './style.service';

@Module({
  imports: [AdminModule, BellaiModule],
  controllers: [StyleController],
  providers: [StyleService],
  exports: [StyleService],
})
export class StyleModule {}
