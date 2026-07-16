import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { JOB_QUEUE_TOKEN } from './queue.constants';
import {
  EnqueueInput,
  QueueJobCounts,
  QueueJobData,
  mapJobPriorityToBullMq,
  toQueueJobName,
} from './queue.types';

export type JobQueue = Queue<QueueJobData>;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private closed = false;

  constructor(@Inject(JOB_QUEUE_TOKEN) private readonly queue: JobQueue) {}

  enqueue(input: EnqueueInput): Promise<Job<QueueJobData>> {
    const options: {
      jobId: string;
      priority: number;
      delay?: number;
    } = {
      jobId: input.jobId,
      priority: mapJobPriorityToBullMq(input.priority),
    };

    if (input.delayMs !== undefined && input.delayMs > 0) {
      options.delay = input.delayMs;
    }

    return this.queue.add(
      toQueueJobName(input.type),
      {
        jobId: input.jobId,
        type: input.type,
        payload: input.payload,
      },
      options,
    );
  }

  getJob(jobId: string): Promise<Job<QueueJobData> | undefined> {
    return this.queue.getJob(jobId);
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  pause(): Promise<void> {
    return this.queue.pause();
  }

  resume(): Promise<void> {
    return this.queue.resume();
  }

  isPaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
    );

    return {
      waiting: counts.waiting,
      active: counts.active,
      delayed: counts.delayed,
      completed: counts.completed,
      failed: counts.failed,
    };
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.queue.close();
    this.closed = true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
