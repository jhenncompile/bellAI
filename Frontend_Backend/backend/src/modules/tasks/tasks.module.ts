import { Global, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Global()
@Module({
  imports: [AdminModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
