import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Job,
  JobPriority,
  JobStatus,
  JobType,
} from '@prisma/client';
import { QueueService } from '../../queue/queue.service';
import { InvalidJobScheduleError } from '../errors/invalid-job-schedule.error';
import { JobsService } from '../jobs.service';
import { JobRepository } from '../repositories/job.repository';
import { CreateJobInput } from '../types/create-job-input';

describe('JobsService', () => {
  let service: JobsService;
  let jobRepository: {
    create: jest.Mock;
    markEnqueueFailed: jest.Mock;
  };
  let queueService: {
    enqueue: jest.Mock;
  };

  const maxAttempts = 3;
  const baseInput: CreateJobInput = {
    type: JobType.EMAIL,
    priority: JobPriority.NORMAL,
    payload: { to: 'test@example.com' },
  };

  const createdJob: Job = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: JobType.EMAIL,
    payload: { to: 'test@example.com' },
    priority: JobPriority.NORMAL,
    status: JobStatus.QUEUED,
    retryCount: 0,
    maxAttempts,
    delayMs: null,
    runAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    lastError: null,
    processingTimeMs: null,
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    updatedAt: new Date('2026-07-16T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jobRepository = {
      create: jest.fn(),
      markEnqueueFailed: jest.fn(),
    };
    queueService = {
      enqueue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: JobRepository,
          useValue: jobRepository,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'queue') {
                return { maxAttempts };
              }

              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(JobsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createJob success', () => {
    beforeEach(() => {
      jobRepository.create.mockResolvedValue(createdJob);
      queueService.enqueue.mockResolvedValue({});
    });

    it('creates a PostgreSQL job first with configured maxAttempts', async () => {
      await service.createJob(baseInput);

      expect(jobRepository.create).toHaveBeenCalledWith({
        type: baseInput.type,
        priority: baseInput.priority,
        payload: baseInput.payload,
        status: JobStatus.QUEUED,
        retryCount: 0,
        maxAttempts,
        delayMs: null,
        runAt: null,
      });
    });

    it('enqueues using the created database UUID and returns queued result', async () => {
      const result = await service.createJob(baseInput);

      expect(queueService.enqueue).toHaveBeenCalledWith({
        jobId: createdJob.id,
        type: baseInput.type,
        payload: baseInput.payload,
        priority: baseInput.priority,
      });
      expect(result).toEqual({
        jobId: createdJob.id,
        status: 'queued',
      });
    });

    it('passes priority and payload correctly', async () => {
      const input: CreateJobInput = {
        type: JobType.SMS,
        priority: JobPriority.HIGH,
        payload: { phone: '+15551234567', message: 'hello' },
      };
      const job = { ...createdJob, ...input };
      jobRepository.create.mockResolvedValue(job);

      await service.createJob(input);

      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JobType.SMS,
          priority: JobPriority.HIGH,
          payload: input.payload,
        }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith({
        jobId: job.id,
        type: JobType.SMS,
        payload: input.payload,
        priority: JobPriority.HIGH,
      });
    });
  });

  describe('createJob delay', () => {
    it('persists and enqueues a positive delayMs', async () => {
      const delayedJob = { ...createdJob, delayMs: 5000 };
      jobRepository.create.mockResolvedValue(delayedJob);
      queueService.enqueue.mockResolvedValue({});

      await service.createJob({ ...baseInput, delayMs: 5000 });

      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ delayMs: 5000, runAt: null }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith({
        jobId: delayedJob.id,
        type: baseInput.type,
        payload: baseInput.payload,
        priority: baseInput.priority,
        delayMs: 5000,
      });
    });

    it('treats delayMs=0 as immediate and omits delay from queue options', async () => {
      jobRepository.create.mockResolvedValue(createdJob);
      queueService.enqueue.mockResolvedValue({});

      await service.createJob({ ...baseInput, delayMs: 0 });

      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ delayMs: null, runAt: null }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith({
        jobId: createdJob.id,
        type: baseInput.type,
        payload: baseInput.payload,
        priority: baseInput.priority,
      });
    });

    it('rejects negative delayMs before repository create', async () => {
      await expect(
        service.createJob({ ...baseInput, delayMs: -1 }),
      ).rejects.toThrow(InvalidJobScheduleError);

      expect(jobRepository.create).not.toHaveBeenCalled();
      expect(queueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('createJob scheduling', () => {
    const now = new Date('2026-07-16T12:00:00.000Z').getTime();

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(now);
    });

    it('calculates delay from future runAt and persists runAt', async () => {
      const runAt = new Date(now + 60_000);
      const delayedJob = { ...createdJob, delayMs: 60_000, runAt };
      jobRepository.create.mockResolvedValue(delayedJob);
      queueService.enqueue.mockResolvedValue({});

      await service.createJob({ ...baseInput, runAt });

      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ delayMs: 60_000, runAt }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith({
        jobId: delayedJob.id,
        type: baseInput.type,
        payload: baseInput.payload,
        priority: baseInput.priority,
        delayMs: 60_000,
      });
    });

    it('rejects past runAt', async () => {
      const runAt = new Date(now - 1);

      await expect(
        service.createJob({ ...baseInput, runAt }),
      ).rejects.toThrow(InvalidJobScheduleError);

      expect(jobRepository.create).not.toHaveBeenCalled();
    });

    it('rejects delayMs and runAt together', async () => {
      const runAt = new Date(now + 60_000);

      await expect(
        service.createJob({ ...baseInput, delayMs: 1000, runAt }),
      ).rejects.toThrow(InvalidJobScheduleError);

      expect(jobRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createJob enqueue failure', () => {
    const queueError = new Error('Redis connection refused');

    beforeEach(() => {
      jobRepository.create.mockResolvedValue(createdJob);
      queueService.enqueue.mockRejectedValue(queueError);
      jobRepository.markEnqueueFailed.mockResolvedValue({
        ...createdJob,
        status: JobStatus.FAILED,
        failedAt: new Date('2026-07-16T12:00:00.000Z'),
        lastError: 'Failed to enqueue job',
      });
    });

    it('marks the job failed and rethrows the original queue error', async () => {
      await expect(service.createJob(baseInput)).rejects.toThrow(queueError);

      expect(jobRepository.create).toHaveBeenCalledTimes(1);
      expect(jobRepository.markEnqueueFailed).toHaveBeenCalledWith(
        createdJob.id,
        'Failed to enqueue job',
        expect.any(Date),
      );
    });

    it('does not create a job attempt record', async () => {
      await expect(service.createJob(baseInput)).rejects.toThrow();

      expect(jobRepository.markEnqueueFailed).toHaveBeenCalledTimes(1);
    });
  });
});
