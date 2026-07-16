import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobStatus } from '@prisma/client';
import { AppConfiguration } from '../config/configuration';
import { QueueService } from '../queue/queue.service';
import { ListJobsDto } from './dto/list-jobs.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto';
import { InvalidJobScheduleError } from './errors/invalid-job-schedule.error';
import {
  buildJobWhereInput,
  JobResponseDto,
  toJobResponseDto,
  toJobSummaryResponseDto,
} from './jobs.mapper';
import { JobRepository } from './repositories/job.repository';
import { CreateJobInput } from './types/create-job-input';
import { CreateJobResult } from './types/create-job-result';

const ENQUEUE_FAILURE_MESSAGE = 'Failed to enqueue job';

interface ResolvedSchedule {
  delayMs: number | null;
  runAt: Date | null;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {}

  async createJob(input: CreateJobInput): Promise<CreateJobResult> {
    const schedule = this.resolveDelay(input);
    const maxAttempts = this.configService.get('queue', { infer: true }).maxAttempts;

    const job = await this.jobRepository.create({
      type: input.type,
      priority: input.priority,
      payload: input.payload,
      status: JobStatus.QUEUED,
      retryCount: 0,
      maxAttempts,
      delayMs: schedule.delayMs,
      runAt: schedule.runAt,
    });

    this.logger.log({
      event: 'JOB_RECEIVED',
      jobId: job.id,
      type: input.type,
      priority: input.priority,
      delayMs: schedule.delayMs,
      runAt: schedule.runAt?.toISOString() ?? null,
    });

    try {
      await this.queueService.enqueue({
        jobId: job.id,
        type: input.type,
        payload: job.payload,
        priority: input.priority,
        ...(schedule.delayMs !== null && schedule.delayMs > 0
          ? { delayMs: schedule.delayMs }
          : {}),
      });
    } catch (error) {
      this.logger.error({
        event: 'JOB_ENQUEUE_FAILED',
        jobId: job.id,
        type: input.type,
      });

      await this.jobRepository.markEnqueueFailed(
        job.id,
        ENQUEUE_FAILURE_MESSAGE,
        new Date(),
      );

      throw error;
    }

    this.logger.log({
      event: 'JOB_QUEUED',
      jobId: job.id,
    });

    return {
      jobId: job.id,
      status: 'queued',
    };
  }

  async getJob(id: string): Promise<JobResponseDto> {
    const job = await this.jobRepository.findById(id);

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    return toJobResponseDto(job);
  }

  async listJobs(query: ListJobsDto): Promise<PaginatedJobsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const where = buildJobWhereInput({
      status: query.status,
      type: query.type,
      priority: query.priority,
    });

    const [jobs, total] = await Promise.all([
      this.jobRepository.findMany({
        page,
        pageSize,
        where,
        sortBy,
        order,
      }),
      this.jobRepository.count(where),
    ]);

    return {
      items: jobs.map(toJobSummaryResponseDto),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private resolveDelay(input: CreateJobInput): ResolvedSchedule {
    const hasDelayMs = input.delayMs !== undefined;
    const hasRunAt = input.runAt !== undefined;

    if (hasDelayMs && hasRunAt) {
      throw new InvalidJobScheduleError(
        'delayMs and runAt cannot both be provided',
      );
    }

    if (hasRunAt && input.runAt) {
      const delayMs = input.runAt.getTime() - Date.now();

      if (delayMs <= 0) {
        throw new InvalidJobScheduleError('runAt must be in the future');
      }

      return { delayMs, runAt: input.runAt };
    }

    if (hasDelayMs) {
      if (input.delayMs! < 0) {
        throw new InvalidJobScheduleError('delayMs cannot be negative');
      }

      if (input.delayMs === 0) {
        return { delayMs: null, runAt: null };
      }

      return { delayMs: input.delayMs!, runAt: null };
    }

    return { delayMs: null, runAt: null };
  }
}
