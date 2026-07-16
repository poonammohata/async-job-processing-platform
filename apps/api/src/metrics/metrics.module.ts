import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { QueueModule } from '../queue/queue.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [JobsModule, QueueModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
