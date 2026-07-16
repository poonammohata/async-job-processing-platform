import { Injectable } from '@nestjs/common';
import { JobAttempt, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAttempt(data: Prisma.JobAttemptCreateInput): Promise<JobAttempt> {
    return this.prisma.jobAttempt.create({ data });
  }

  findByJobId(jobId: string): Promise<JobAttempt[]> {
    return this.prisma.jobAttempt.findMany({
      where: { jobId },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  findLatestAttempt(jobId: string): Promise<JobAttempt | null> {
    return this.prisma.jobAttempt.findFirst({
      where: { jobId },
      orderBy: { attemptNumber: 'desc' },
    });
  }
}
