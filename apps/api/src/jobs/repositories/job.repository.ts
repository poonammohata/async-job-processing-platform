import { Injectable } from '@nestjs/common';
import { Job, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FindManyJobsOptions,
  FindDeadLetterJobsOptions,
  JOB_LIST_SELECT,
  JobSummary,
  JobWithAttempts,
  buildDeadLetterJobWhereInput,
} from '../jobs.mapper';

@Injectable()
export class JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.JobCreateInput): Promise<Job> {
    return this.prisma.job.create({ data });
  }

  findById(id: string): Promise<JobWithAttempts | null> {
    return this.prisma.job.findUnique({
      where: { id },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    });
  }

  findMany(options: FindManyJobsOptions): Promise<JobSummary[]> {
    const skip = (options.page - 1) * options.pageSize;

    return this.prisma.job.findMany({
      where: options.where,
      select: JOB_LIST_SELECT,
      skip,
      take: options.pageSize,
      orderBy: {
        [options.sortBy]: options.order,
      },
    });
  }

  findDeadLetterJobs(options: FindDeadLetterJobsOptions): Promise<JobSummary[]> {
    const skip = (options.page - 1) * options.pageSize;
    const where = buildDeadLetterJobWhereInput({
      type: options.type,
      priority: options.priority,
    });

    return this.prisma.job.findMany({
      where,
      select: JOB_LIST_SELECT,
      skip,
      take: options.pageSize,
      orderBy: {
        [options.sortBy]: options.order,
      },
    });
  }

  count(where: Prisma.JobWhereInput): Promise<number> {
    return this.prisma.job.count({ where });
  }

  countCompletedJobs(): Promise<number> {
    return this.prisma.job.count({
      where: { status: JobStatus.COMPLETED },
    });
  }

  countFailedJobs(): Promise<number> {
    return this.prisma.job.count({
      where: { status: JobStatus.FAILED },
    });
  }

  async averageProcessingTimeMs(): Promise<number | null> {
    const result = await this.prisma.job.aggregate({
      where: {
        status: JobStatus.COMPLETED,
        processingTimeMs: { not: null },
      },
      _avg: {
        processingTimeMs: true,
      },
    });

    return result._avg.processingTimeMs;
  }

  async exists(id: string): Promise<boolean> {
    const total = await this.count({ id });
    return total > 0;
  }

  markEnqueueFailed(
    id: string,
    errorMessage: string,
    failedAt: Date,
  ): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        failedAt,
        lastError: errorMessage,
      },
    });
  }

  async markProcessing(id: string, startedAt: Date): Promise<Job> {
    const existing = await this.prisma.job.findUnique({ where: { id } });

    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.PROCESSING,
        ...(existing?.startedAt ? {} : { startedAt }),
      },
    });
  }

  markRetryQueued(
    id: string,
    retryCount: number,
    lastError: string,
  ): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.QUEUED,
        retryCount,
        lastError,
        failedAt: null,
      },
    });
  }

  markCompleted(
    id: string,
    completedAt: Date,
    processingTimeMs: number,
    retryCount: number,
  ): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt,
        processingTimeMs,
        retryCount,
        lastError: null,
        failedAt: null,
      },
    });
  }

  markFailed(
    id: string,
    failedAt: Date,
    lastError: string,
    retryCount: number,
  ): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        failedAt,
        lastError,
        retryCount,
      },
    });
  }

  markCancelled(id: string, cancelledAt: Date): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.CANCELLED,
        cancelledAt,
      },
    });
  }
}
