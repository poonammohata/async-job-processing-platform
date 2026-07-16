import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobAttemptRepository } from './repositories/job-attempt.repository';
import { JobRepository } from './repositories/job.repository';

@Module({
  imports: [PrismaModule],
  providers: [JobRepository, JobAttemptRepository],
  exports: [JobRepository, JobAttemptRepository],
})
export class JobsModule {}
