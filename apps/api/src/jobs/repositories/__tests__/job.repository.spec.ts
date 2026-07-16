import { Test, TestingModule } from '@nestjs/testing';
import {
  JobAttemptStatus,
  JobPriority,
  JobStatus,
  JobType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { JOB_LIST_SELECT } from '../../jobs.mapper';
import { JobRepository } from '../job.repository';

describe('JobRepository', () => {
  let repository: JobRepository;
  let prisma: {
    job: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };

  const job = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: JobType.EMAIL,
    payload: { to: 'test@example.com' },
    priority: JobPriority.NORMAL,
    status: JobStatus.QUEUED,
    retryCount: 0,
    maxAttempts: 3,
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

  const attempt = {
    id: 'attempt-1',
    jobId: job.id,
    attemptNumber: 1,
    status: JobAttemptStatus.COMPLETED,
    errorMessage: null,
    startedAt: new Date('2026-07-16T10:00:01.000Z'),
    completedAt: new Date('2026-07-16T10:00:02.000Z'),
    processingTimeMs: 1000,
    createdAt: new Date('2026-07-16T10:00:01.000Z'),
    updatedAt: new Date('2026-07-16T10:00:02.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      job: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repository = module.get(JobRepository);
  });

  describe('create', () => {
    it('creates a job', async () => {
      const data: Prisma.JobCreateInput = {
        type: JobType.EMAIL,
        payload: { to: 'test@example.com' },
      };

      prisma.job.create.mockResolvedValue(job);

      await expect(repository.create(data)).resolves.toEqual(job);
      expect(prisma.job.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findById', () => {
    it('returns a job with attempts ordered by attemptNumber', async () => {
      const jobWithAttempts = { ...job, attempts: [attempt] };
      prisma.job.findUnique.mockResolvedValue(jobWithAttempts);

      await expect(repository.findById(job.id)).resolves.toEqual(
        jobWithAttempts,
      );
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: job.id },
        include: {
          attempts: {
            orderBy: { attemptNumber: 'asc' },
          },
        },
      });
    });

    it('returns null when not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findMany', () => {
    it('paginates with skip and take', async () => {
      prisma.job.findMany.mockResolvedValue([job]);

      await expect(
        repository.findMany({
          page: 2,
          pageSize: 10,
          where: {},
          sortBy: 'createdAt',
          order: 'desc',
        }),
      ).resolves.toEqual([job]);

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: {},
        select: JOB_LIST_SELECT,
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies filters and sort order', async () => {
      prisma.job.findMany.mockResolvedValue([job]);

      await repository.findMany({
        page: 1,
        pageSize: 20,
        where: {
          status: JobStatus.QUEUED,
          type: JobType.EMAIL,
          priority: JobPriority.HIGH,
        },
        sortBy: 'createdAt',
        order: 'asc',
      });

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: {
          status: JobStatus.QUEUED,
          type: JobType.EMAIL,
          priority: JobPriority.HIGH,
        },
        select: JOB_LIST_SELECT,
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('count', () => {
    it('returns the total for a where clause', async () => {
      prisma.job.count.mockResolvedValue(5);

      await expect(
        repository.count({ status: JobStatus.COMPLETED }),
      ).resolves.toBe(5);
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { status: JobStatus.COMPLETED },
      });
    });
  });

  describe('exists', () => {
    it('returns true when the job exists', async () => {
      prisma.job.count.mockResolvedValue(1);

      await expect(repository.exists(job.id)).resolves.toBe(true);
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { id: job.id },
      });
    });

    it('returns false when the job does not exist', async () => {
      prisma.job.count.mockResolvedValue(0);

      await expect(repository.exists('missing')).resolves.toBe(false);
    });
  });

  describe('markEnqueueFailed', () => {
    it('updates status, failedAt, and lastError', async () => {
      const failedAt = new Date('2026-07-16T12:00:00.000Z');
      const failedJob = {
        ...job,
        status: JobStatus.FAILED,
        failedAt,
        lastError: 'Failed to enqueue job',
      };

      prisma.job.update.mockResolvedValue(failedJob);

      await expect(
        repository.markEnqueueFailed(
          job.id,
          'Failed to enqueue job',
          failedAt,
        ),
      ).resolves.toEqual(failedJob);
    });
  });

  describe('markProcessing', () => {
    it('sets status to PROCESSING and startedAt on first start', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...job, startedAt: null });
      prisma.job.update.mockResolvedValue(job);
      const startedAt = new Date('2026-07-16T10:00:01.000Z');

      await repository.markProcessing(job.id, startedAt);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: JobStatus.PROCESSING,
          startedAt,
        },
      });
    });
  });

  describe('markRetryQueued', () => {
    it('updates retry fields and clears failedAt', async () => {
      prisma.job.update.mockResolvedValue(job);

      await repository.markRetryQueued(job.id, 1, 'Simulated failure');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: JobStatus.QUEUED,
          retryCount: 1,
          lastError: 'Simulated failure',
          failedAt: null,
        },
      });
    });
  });

  describe('markCompleted', () => {
    it('updates completion fields and clears errors', async () => {
      const completedAt = new Date('2026-07-16T10:00:02.000Z');
      prisma.job.update.mockResolvedValue(job);

      await repository.markCompleted(job.id, completedAt, 1000, 2);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt,
          processingTimeMs: 1000,
          retryCount: 2,
          lastError: null,
          failedAt: null,
        },
      });
    });
  });

  describe('markFailed', () => {
    it('updates failure fields', async () => {
      const failedAt = new Date('2026-07-16T10:00:02.000Z');
      prisma.job.update.mockResolvedValue(job);

      await repository.markFailed(
        job.id,
        failedAt,
        'Simulated permanent processing failure',
        3,
      );

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          failedAt,
          lastError: 'Simulated permanent processing failure',
          retryCount: 3,
        },
      });
    });
  });
});
