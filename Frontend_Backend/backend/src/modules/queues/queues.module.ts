import { Module, Global } from '@nestjs/common';
import { AsyncQueueService } from './async-queue.service';

@Global()
@Module({
  providers: [AsyncQueueService],
  exports: [AsyncQueueService],
})
export class QueuesModule {}
