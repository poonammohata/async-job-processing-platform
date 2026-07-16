import { Test, TestingModule } from '@nestjs/testing';
import {
  JobPriority,
  JobStatus,
  JobType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobRepository } from '../job.repository';

describe('JobRepository', () => {
  let repository: JobRepository;
  let prisma: {
    $transaction: jest.Mock;
    job: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };

  const job = {
    id: 'job-1',
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

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
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
    it('returns a job when found', async () => {
      prisma.job.findUnique.mockResolvedValue(job);

      await expect(repository.findById('job-1')).resolves.toEqual(job);
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
      });
    });

    it('returns null when not found', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findMany', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      );
    });

    it('paginates with skip and take and returns jobs with total', async () => {
      prisma.job.findMany.mockResolvedValue([job]);
      prisma.job.count.mockResolvedValue(1);

      await expect(
        repository.findMany({ page: 2, limit: 10 }),
      ).resolves.toEqual({ jobs: [job], total: 1 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.job.count).toHaveBeenCalledWith({ where: {} });
    });

    it('applies optional status filter to findMany and count', async () => {
      prisma.job.findMany.mockResolvedValue([job]);
      prisma.job.count.mockResolvedValue(1);

      await repository.findMany({
        page: 1,
        limit: 20,
        status: JobStatus.QUEUED,
      });

      expect(prisma.job.findMany).toHaveBeenCalledWith({
        where: { status: JobStatus.QUEUED },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { status: JobStatus.QUEUED },
      });
    });

    it('sorts by createdAt using the requested order', async () => {
      prisma.job.findMany.mockResolvedValue([job]);
      prisma.job.count.mockResolvedValue(1);

      await repository.findMany({
        page: 1,
        limit: 20,
        orderBy: 'asc',
      });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('exists', () => {
    it('returns true when the job exists', async () => {
      prisma.job.count.mockResolvedValue(1);

      await expect(repository.exists('job-1')).resolves.toBe(true);
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { id: 'job-1' },
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
          'job-1',
          'Failed to enqueue job',
          failedAt,
        ),
      ).resolves.toEqual(failedJob);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: JobStatus.FAILED,
          failedAt,
          lastError: 'Failed to enqueue job',
        },
      });
    });
  });

  describe('markProcessing', () => {
    it('sets status to PROCESSING and startedAt on first start', async () => {
      prisma.job.findUnique.mockResolvedValue({ ...job, startedAt: null });
      prisma.job.update.mockResolvedValue({
        ...job,
        status: JobStatus.PROCESSING,
        startedAt: new Date('2026-07-16T10:00:01.000Z'),
      });
      const startedAt = new Date('2026-07-16T10:00:01.000Z');

      await repository.markProcessing('job-1', startedAt);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: JobStatus.PROCESSING,
          startedAt,
        },
      });
    });

    it('preserves existing startedAt on retries', async () => {
      const existingStartedAt = new Date('2026-07-16T10:00:00.000Z');
      prisma.job.findUnique.mockResolvedValue({
        ...job,
        startedAt: existingStartedAt,
      });
      prisma.job.update.mockResolvedValue(job);

      await repository.markProcessing(
        'job-1',
        new Date('2026-07-16T10:00:05.000Z'),
      );

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: JobStatus.PROCESSING,
        },
      });
    });
  });

  describe('markRetryQueued', () => {
    it('updates retry fields and clears failedAt', async () => {
      prisma.job.update.mockResolvedValue(job);

      await repository.markRetryQueued('job-1', 1, 'Simulated failure');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
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

      await repository.markCompleted('job-1', completedAt, 1000, 2);

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
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
        'job-1',
        failedAt,
        'Simulated permanent processing failure',
        3,
      );

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
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
