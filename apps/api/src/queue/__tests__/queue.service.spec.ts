import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import { JobPriority, JobType } from '@prisma/client';
import {
  JOB_QUEUE_CONNECTION_TOKEN,
  JOB_QUEUE_TOKEN,
} from '../queue.constants';
import { QueueService } from '../queue.service';
import { QueueJobData } from '../queue.types';
import { QueueModule } from '../queue.module';
import { RedisConnectionService } from '../redis-connection.service';

describe('QueueModule queue provider', () => {
  it('uses configured default attempts and backoff with the shared connection token', async () => {
    const queueConfig = {
      name: 'jobs',
      maxAttempts: 3,
      backoffDelayMs: 1000,
      workerConcurrency: 1,
    };

    const connection = { quit: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      imports: [QueueModule],
    })
      .overrideProvider(RedisConnectionService)
      .useValue({
        getConnection: () => connection,
        createConnection: () => connection,
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(JOB_QUEUE_CONNECTION_TOKEN)
      .useValue(connection)
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          if (key === 'queue') {
            return queueConfig;
          }

          return undefined;
        }),
      })
      .compile();

    const queue = module.get<Queue<QueueJobData>>(JOB_QUEUE_TOKEN);

    expect(queue.name).toBe('jobs');
    expect(queue.opts.connection).toBe(connection);
    expect(queue.opts.defaultJobOptions).toEqual({
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    await module.close();
  });
});

describe('QueueService', () => {
  let service: QueueService;
  let queue: {
    add: jest.Mock;
    getJob: jest.Mock;
    pause: jest.Mock;
    resume: jest.Mock;
    isPaused: jest.Mock;
    getJobCounts: jest.Mock;
    close: jest.Mock;
  };

  const enqueueInput = {
    jobId: '550e8400-e29b-41d4-a716-446655440000',
    type: JobType.EMAIL,
    payload: { to: 'test@example.com' },
    priority: JobPriority.NORMAL,
  };

  beforeEach(async () => {
    queue = {
      add: jest.fn(),
      getJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
      getJobCounts: jest.fn(),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: JOB_QUEUE_TOKEN,
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get(QueueService);
  });

  describe('enqueue', () => {
    it('uses the database UUID as BullMQ jobId and lowercases the job name', async () => {
      const bullJob = { id: enqueueInput.jobId } as Job<QueueJobData>;
      queue.add.mockResolvedValue(bullJob);

      await expect(service.enqueue(enqueueInput)).resolves.toBe(bullJob);

      expect(queue.add).toHaveBeenCalledWith(
        'email',
        {
          jobId: enqueueInput.jobId,
          type: JobType.EMAIL,
          payload: enqueueInput.payload,
        },
        {
          jobId: enqueueInput.jobId,
          priority: 5,
        },
      );
    });

    it('maps HIGH priority to 1', async () => {
      queue.add.mockResolvedValue({} as Job<QueueJobData>);

      await service.enqueue({
        ...enqueueInput,
        priority: JobPriority.HIGH,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'email',
        expect.any(Object),
        expect.objectContaining({ priority: 1 }),
      );
    });

    it('maps LOW priority to 10', async () => {
      queue.add.mockResolvedValue({} as Job<QueueJobData>);

      await service.enqueue({
        ...enqueueInput,
        priority: JobPriority.LOW,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'email',
        expect.any(Object),
        expect.objectContaining({ priority: 10 }),
      );
    });

    it('includes delay when greater than zero', async () => {
      queue.add.mockResolvedValue({} as Job<QueueJobData>);

      await service.enqueue({
        ...enqueueInput,
        delayMs: 5000,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'email',
        expect.any(Object),
        expect.objectContaining({ delay: 5000 }),
      );
    });

    it('omits delay when undefined or zero', async () => {
      queue.add.mockResolvedValue({} as Job<QueueJobData>);

      await service.enqueue(enqueueInput);
      await service.enqueue({ ...enqueueInput, delayMs: 0 });

      expect(queue.add).toHaveBeenNthCalledWith(
        1,
        'email',
        expect.any(Object),
        {
          jobId: enqueueInput.jobId,
          priority: 5,
        },
      );
      expect(queue.add).toHaveBeenNthCalledWith(
        2,
        'email',
        expect.any(Object),
        {
          jobId: enqueueInput.jobId,
          priority: 5,
        },
      );
    });
  });

  describe('getJob', () => {
    it('delegates to the queue', async () => {
      const bullJob = { id: enqueueInput.jobId } as Job<QueueJobData>;
      queue.getJob.mockResolvedValue(bullJob);

      await expect(service.getJob(enqueueInput.jobId)).resolves.toBe(bullJob);
      expect(queue.getJob).toHaveBeenCalledWith(enqueueInput.jobId);
    });
  });

  describe('removeJob', () => {
    it('returns false when the job does not exist', async () => {
      queue.getJob.mockResolvedValue(undefined);

      await expect(service.removeJob('missing')).resolves.toBe(false);
    });

    it('removes the job and returns true when it exists', async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      queue.getJob.mockResolvedValue({ remove } as unknown as Job<QueueJobData>);

      await expect(service.removeJob(enqueueInput.jobId)).resolves.toBe(true);
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause', () => {
    it('delegates to the queue', async () => {
      queue.pause.mockResolvedValue(undefined);

      await service.pause();

      expect(queue.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('resume', () => {
    it('delegates to the queue', async () => {
      queue.resume.mockResolvedValue(undefined);

      await service.resume();

      expect(queue.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe('isPaused', () => {
    it('delegates to the queue', async () => {
      queue.isPaused.mockResolvedValue(true);

      await expect(service.isPaused()).resolves.toBe(true);
      expect(queue.isPaused).toHaveBeenCalledTimes(1);
    });
  });

  describe('getJobCounts', () => {
    it('returns the explicit normalized count object', async () => {
      queue.getJobCounts.mockResolvedValue({
        waiting: 1,
        active: 2,
        delayed: 3,
        completed: 4,
        failed: 5,
        paused: 99,
      });

      await expect(service.getJobCounts()).resolves.toEqual({
        waiting: 1,
        active: 2,
        delayed: 3,
        completed: 4,
        failed: 5,
      });
      expect(queue.getJobCounts).toHaveBeenCalledWith(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
      );
    });
  });

  describe('close', () => {
    it('delegates to the queue and is idempotent', async () => {
      queue.close.mockResolvedValue(undefined);

      await service.close();
      await service.close();

      expect(queue.close).toHaveBeenCalledTimes(1);
    });

    it('does not mark closed when queue.close rejects and allows retry', async () => {
      queue.close
        .mockRejectedValueOnce(new Error('close failed'))
        .mockResolvedValueOnce(undefined);

      await expect(service.close()).rejects.toThrow('close failed');
      await service.close();

      expect(queue.close).toHaveBeenCalledTimes(2);
    });
  });
});
