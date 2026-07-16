import { Injectable } from '@nestjs/common';
import { JobAttempt, JobAttemptStatus } from '@prisma/client';
import { AttemptConsistencyError } from '../errors/attempt-consistency.error';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startAttempt(
    jobId: string,
    attemptNumber: number,
    startedAt: Date,
  ): Promise<JobAttempt> {
    const existing = await this.prisma.jobAttempt.findUnique({
      where: {
        jobId_attemptNumber: { jobId, attemptNumber },
      },
    });

    if (existing?.status === JobAttemptStatus.COMPLETED) {
      throw new AttemptConsistencyError(
        `Attempt ${attemptNumber} for job ${jobId} is already completed`,
      );
    }

    if (existing?.status === JobAttemptStatus.FAILED) {
      throw new AttemptConsistencyError(
        `Attempt ${attemptNumber} for job ${jobId} is already failed`,
      );
    }

    return this.prisma.jobAttempt.upsert({
      where: {
        jobId_attemptNumber: { jobId, attemptNumber },
      },
      create: {
        job: { connect: { id: jobId } },
        attemptNumber,
        status: JobAttemptStatus.PROCESSING,
        startedAt,
      },
      update: {
        status: JobAttemptStatus.PROCESSING,
        ...(existing?.startedAt ? {} : { startedAt }),
      },
    });
  }

  markAttemptCompleted(
    jobId: string,
    attemptNumber: number,
    completedAt: Date,
    processingTimeMs: number,
  ): Promise<JobAttempt> {
    return this.prisma.jobAttempt.update({
      where: {
        jobId_attemptNumber: { jobId, attemptNumber },
      },
      data: {
        status: JobAttemptStatus.COMPLETED,
        completedAt,
        processingTimeMs,
        errorMessage: null,
      },
    });
  }

  markAttemptFailed(
    jobId: string,
    attemptNumber: number,
    completedAt: Date,
    processingTimeMs: number,
    errorMessage: string,
  ): Promise<JobAttempt> {
    return this.prisma.jobAttempt.update({
      where: {
        jobId_attemptNumber: { jobId, attemptNumber },
      },
      data: {
        status: JobAttemptStatus.FAILED,
        completedAt,
        processingTimeMs,
        errorMessage,
      },
    });
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
