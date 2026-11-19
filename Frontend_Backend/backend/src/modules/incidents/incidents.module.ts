import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AdminIncidentsController, IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AdminModule],
  controllers: [IncidentsController, AdminIncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
