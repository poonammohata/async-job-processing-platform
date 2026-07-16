import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobType } from '@prisma/client';
import { Job as BullMqJob } from 'bullmq';
import { AppConfiguration } from '../config/configuration';
import { JobAttemptRepository } from '../jobs/repositories/job-attempt.repository';
import { JobRepository } from '../jobs/repositories/job.repository';
import { QueueJobData } from '../queue/queue.types';
import {
  evaluateSimulationFailure,
  getPayloadKeys,
  sanitizeProcessingError,
} from './job-processing.utils';

@Injectable()
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobAttemptRepository: JobAttemptRepository,
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {}

  async process(job: BullMqJob<QueueJobData>): Promise<void> {
    const jobId = job.data.jobId;
    const jobType = job.data.type;
    // attemptsMade counts completed attempts before this run; add 1 for the current execution.
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts =
      job.opts.attempts ??
      this.configService.get('queue', { infer: true }).maxAttempts;
    const startedAt = new Date(Date.now());
    const startTime = Date.now();

    await this.jobAttemptRepository.startAttempt(
      jobId,
      attemptNumber,
      startedAt,
    );
    await this.jobRepository.markProcessing(jobId, startedAt);

    this.logger.log({
      event: 'JOB_STARTED',
      jobId,
      type: jobType,
      attemptNumber,
    });

    let processingError: unknown;
    try {
      await this.simulateWork(
        job.data.payload,
        attemptNumber,
        jobId,
        jobType,
      );
    } catch (error) {
      processingError = error;
    }

    const completedAt = new Date(Date.now());
    const processingTimeMs = Date.now() - startTime;

    if (processingError !== undefined) {
      const sanitizedError = sanitizeProcessingError(processingError);
      const isFinalAttempt = attemptNumber >= maxAttempts;

      await this.jobAttemptRepository.markAttemptFailed(
        jobId,
        attemptNumber,
        completedAt,
        processingTimeMs,
        sanitizedError,
      );

      if (isFinalAttempt) {
        await this.jobRepository.markFailed(
          jobId,
          completedAt,
          sanitizedError,
          attemptNumber,
        );

        this.logger.error({
          event: 'JOB_FAILED',
          jobId,
          type: jobType,
          attemptNumber,
          retryCount: attemptNumber,
          lastError: sanitizedError,
        });
      } else {
        await this.jobRepository.markRetryQueued(
          jobId,
          attemptNumber,
          sanitizedError,
        );

        this.logger.warn({
          event: 'JOB_RETRY_SCHEDULED',
          jobId,
          type: jobType,
          attemptNumber,
          retryCount: attemptNumber,
          lastError: sanitizedError,
        });
      }

      throw processingError;
    }

    await this.jobAttemptRepository.markAttemptCompleted(
      jobId,
      attemptNumber,
      completedAt,
      processingTimeMs,
    );
    await this.jobRepository.markCompleted(
      jobId,
      completedAt,
      processingTimeMs,
      job.attemptsMade,
    );

    this.logger.log({
      event: 'JOB_COMPLETED',
      jobId,
      type: jobType,
      attemptNumber,
      retryCount: job.attemptsMade,
      processingTimeMs,
    });
  }

  private async simulateWork(
    payload: QueueJobData['payload'],
    attemptNumber: number,
    jobId: string,
    type: JobType,
  ): Promise<void> {
    this.logger.log({
      event: 'JOB_PROCESSING',
      jobId,
      type,
      attemptNumber,
      payloadKeys: getPayloadKeys(payload),
    });

    const processingDelayMs = this.configService.get('worker', {
      infer: true,
    }).processingDelayMs;

    if (processingDelayMs > 0) {
      await this.delay(processingDelayMs);
    }

    evaluateSimulationFailure(payload, attemptNumber);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
