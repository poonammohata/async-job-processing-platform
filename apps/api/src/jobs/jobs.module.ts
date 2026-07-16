import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAttemptRepository } from './repositories/job-attempt.repository';
import { JobRepository } from './repositories/job.repository';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [JobsController],
  providers: [JobRepository, JobAttemptRepository, JobsService],
  exports: [JobRepository, JobAttemptRepository, JobsService],
})
export class JobsModule {}
