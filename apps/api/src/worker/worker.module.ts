import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { JobProcessorService } from './job-processor.service';
import { JobWorkerService } from './job-worker.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Module({
  imports: [AppConfigModule, PrismaModule, QueueModule, JobsModule],
  providers: [JobProcessorService, JobWorkerService, WorkerHeartbeatService],
})
export class WorkerModule {}
