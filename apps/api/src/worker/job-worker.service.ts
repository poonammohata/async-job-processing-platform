import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job as BullMqJob, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AppConfiguration } from '../config/configuration';
import { JOB_WORKER_CONNECTION_TOKEN } from '../queue/queue.constants';
import { QueueJobData } from '../queue/queue.types';
import { JobProcessorService } from './job-processor.service';

@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private worker: Worker<QueueJobData> | null = null;
  private closed = false;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
    private readonly jobProcessorService: JobProcessorService,
    @Inject(JOB_WORKER_CONNECTION_TOKEN)
    private readonly workerConnection: Redis,
  ) {}

  onModuleInit(): void {
    const queueConfig = this.configService.get('queue', { infer: true });

    this.worker = new Worker<QueueJobData>(
      queueConfig.name,
      (job) => this.jobProcessorService.process(job),
      {
        connection: this.workerConnection,
        concurrency: queueConfig.workerConcurrency,
      },
    );

    this.attachEventHandlers(this.worker);

    this.logger.log({
      event: 'WORKER_STARTED',
      queueName: queueConfig.name,
      concurrency: queueConfig.workerConcurrency,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    if (this.closed || !this.worker) {
      return;
    }

    this.logger.log({ event: 'WORKER_STOPPING' });

    try {
      await this.worker.close();
      this.closed = true;
    } catch (error) {
      this.logger.error({
        event: 'WORKER_ERROR',
        message: 'Failed to close BullMQ worker',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private attachEventHandlers(worker: Worker<QueueJobData>): void {
    worker.on('completed', (job: BullMqJob<QueueJobData>) => {
      this.logger.log({
        event: 'WORKER_JOB_COMPLETED',
        jobId: job.data.jobId,
        attemptsMade: job.attemptsMade,
      });
    });

    worker.on('failed', (job, error) => {
      this.logger.warn({
        event: 'WORKER_JOB_FAILED',
        jobId: job?.data.jobId ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        error: error.message,
      });
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn({
        event: 'JOB_STALLED',
        jobId,
      });
    });

    worker.on('error', (error) => {
      this.logger.error({
        event: 'WORKER_ERROR',
        error: error.message,
      });
    });
  }
}
