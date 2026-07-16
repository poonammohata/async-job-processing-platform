import { ConflictException, NotFoundException } from '@nestjs/common';
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
    findById: jest.Mock;
    findMany: jest.Mock;
    findDeadLetterJobs: jest.Mock;
    count: jest.Mock;
    markCancelled: jest.Mock;
  };
  let queueService: {
    enqueue: jest.Mock;
    removeJob: jest.Mock;
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
      findById: jest.fn(),
      findMany: jest.fn(),
      findDeadLetterJobs: jest.fn(),
      count: jest.fn(),
      markCancelled: jest.fn(),
    };
    queueService = {
      enqueue: jest.fn(),
      removeJob: jest.fn(),
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

  describe('getJob', () => {
    const jobWithAttempts = {
      ...createdJob,
      attempts: [
        {
          id: 'attempt-1',
          jobId: createdJob.id,
          attemptNumber: 1,
          status: 'COMPLETED',
          errorMessage: null,
          startedAt: new Date('2026-07-16T10:00:01.000Z'),
          completedAt: new Date('2026-07-16T10:00:02.000Z'),
          processingTimeMs: 1000,
          createdAt: new Date('2026-07-16T10:00:01.000Z'),
          updatedAt: new Date('2026-07-16T10:00:02.000Z'),
        },
      ],
    };

    it('returns mapped job details with attempts', async () => {
      jobRepository.findById.mockResolvedValue(jobWithAttempts);

      const result = await service.getJob(createdJob.id);

      expect(jobRepository.findById).toHaveBeenCalledWith(createdJob.id);
      expect(result.id).toBe(createdJob.id);
      expect(result.payload).toEqual(createdJob.payload);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].attemptNumber).toBe(1);
    });

    it('throws NotFoundException when the job does not exist', async () => {
      jobRepository.findById.mockResolvedValue(null);

      await expect(service.getJob('missing')).rejects.toThrow(
        'Job missing not found',
      );
    });
  });

  describe('listJobs', () => {
    it('returns paginated summary items without payload', async () => {
      jobRepository.findMany.mockResolvedValue([createdJob]);
      jobRepository.count.mockResolvedValue(1);

      const result = await service.listJobs({
        page: 1,
        pageSize: 20,
        status: JobStatus.QUEUED,
      });

      expect(jobRepository.findMany).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        where: { status: JobStatus.QUEUED },
        sortBy: 'createdAt',
        order: 'desc',
      });
      expect(jobRepository.count).toHaveBeenCalledWith({
        status: JobStatus.QUEUED,
      });
      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: createdJob.id,
            status: JobStatus.QUEUED,
          }),
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items[0]).not.toHaveProperty('payload');
      expect(result.items[0]).not.toHaveProperty('attempts');
    });

    it('builds dynamic filters for type and priority', async () => {
      jobRepository.findMany.mockResolvedValue([]);
      jobRepository.count.mockResolvedValue(0);

      await service.listJobs({
        type: JobType.SMS,
        priority: JobPriority.HIGH,
        sortBy: 'createdAt',
        order: 'asc',
      });

      expect(jobRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: JobType.SMS,
            priority: JobPriority.HIGH,
          },
          order: 'asc',
        }),
      );
    });
  });

  describe('cancelJob', () => {
    const jobWithAttempts = {
      ...createdJob,
      attempts: [],
    };

    beforeEach(() => {
      jobRepository.markCancelled.mockResolvedValue({
        ...createdJob,
        status: JobStatus.CANCELLED,
        cancelledAt: new Date('2026-07-16T10:05:00.000Z'),
      });
    });

    it('throws NotFoundException when the job does not exist', async () => {
      jobRepository.findById.mockResolvedValue(null);

      await expect(service.cancelJob('missing')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.cancelJob('missing')).rejects.toThrow(
        'Job not found',
      );
      expect(queueService.removeJob).not.toHaveBeenCalled();
      expect(jobRepository.markCancelled).not.toHaveBeenCalled();
    });

    it.each([
      JobStatus.PROCESSING,
      JobStatus.COMPLETED,
      JobStatus.FAILED,
      JobStatus.CANCELLED,
    ])('throws ConflictException for status %s', async (status) => {
      jobRepository.findById.mockResolvedValue({
        ...jobWithAttempts,
        status,
      });

      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        `Job cannot be cancelled in status: ${status.toLowerCase()}`,
      );
      expect(queueService.removeJob).not.toHaveBeenCalled();
      expect(jobRepository.markCancelled).not.toHaveBeenCalled();
    });

    it('marks the job cancelled only after queue removal succeeds', async () => {
      jobRepository.findById.mockResolvedValue(jobWithAttempts);
      queueService.removeJob.mockResolvedValue(true);

      await service.cancelJob(createdJob.id);

      expect(queueService.removeJob).toHaveBeenCalledWith(createdJob.id);
      expect(jobRepository.markCancelled).toHaveBeenCalledWith(
        createdJob.id,
        expect.any(Date),
      );
      expect(queueService.removeJob.mock.invocationCallOrder[0]).toBeLessThan(
        jobRepository.markCancelled.mock.invocationCallOrder[0],
      );
    });

    it('throws ConflictException when queue removal returns false', async () => {
      jobRepository.findById.mockResolvedValue(jobWithAttempts);
      queueService.removeJob.mockResolvedValue(false);

      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        'Job has already started processing and cannot be cancelled',
      );
      expect(jobRepository.markCancelled).not.toHaveBeenCalled();
    });

    it('throws ConflictException when queue removal throws', async () => {
      jobRepository.findById.mockResolvedValue(jobWithAttempts);
      queueService.removeJob.mockRejectedValue(
        new Error('Job is locked by another worker'),
      );

      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.cancelJob(createdJob.id)).rejects.toThrow(
        'Job has already started processing and cannot be cancelled',
      );
      expect(jobRepository.markCancelled).not.toHaveBeenCalled();
    });
  });

  describe('listDeadLetterJobs', () => {
    const failedJob = {
      ...createdJob,
      status: JobStatus.FAILED,
      retryCount: 3,
      failedAt: new Date('2026-07-16T10:00:10.000Z'),
      lastError: 'Simulated permanent failure',
    };

    it('returns paginated summary items without payload or attempts', async () => {
      jobRepository.findDeadLetterJobs.mockResolvedValue([failedJob]);
      jobRepository.count.mockResolvedValue(1);

      const result = await service.listDeadLetterJobs({
        page: 1,
        pageSize: 20,
      });

      expect(jobRepository.findDeadLetterJobs).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        type: undefined,
        priority: undefined,
        sortBy: 'failedAt',
        order: 'desc',
      });
      expect(jobRepository.count).toHaveBeenCalledWith({
        status: JobStatus.FAILED,
        retryCount: { gt: 0 },
      });
      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: failedJob.id,
            status: JobStatus.FAILED,
            lastError: 'Simulated permanent failure',
          }),
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items[0]).not.toHaveProperty('payload');
      expect(result.items[0]).not.toHaveProperty('attempts');
    });

    it('returns empty items when no dead-letter jobs exist', async () => {
      jobRepository.findDeadLetterJobs.mockResolvedValue([]);
      jobRepository.count.mockResolvedValue(0);

      const result = await service.listDeadLetterJobs({});

      expect(result).toEqual({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('forwards type and priority filters and calculates totalPages', async () => {
      jobRepository.findDeadLetterJobs.mockResolvedValue([]);
      jobRepository.count.mockResolvedValue(25);

      const result = await service.listDeadLetterJobs({
        type: JobType.SMS,
        priority: JobPriority.HIGH,
        page: 2,
        pageSize: 10,
        sortBy: 'createdAt',
        order: 'asc',
      });

      expect(jobRepository.findDeadLetterJobs).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        type: JobType.SMS,
        priority: JobPriority.HIGH,
        sortBy: 'createdAt',
        order: 'asc',
      });
      expect(jobRepository.count).toHaveBeenCalledWith({
        status: JobStatus.FAILED,
        retryCount: { gt: 0 },
        type: JobType.SMS,
        priority: JobPriority.HIGH,
      });
      expect(result.totalPages).toBe(3);
    });
  });
});
