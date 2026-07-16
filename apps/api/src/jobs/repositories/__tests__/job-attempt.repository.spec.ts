import { Test, TestingModule } from '@nestjs/testing';
import { JobAttemptStatus } from '@prisma/client';
import { AttemptConsistencyError } from '../../errors/attempt-consistency.error';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobAttemptRepository } from '../job-attempt.repository';

describe('JobAttemptRepository', () => {
  let repository: JobAttemptRepository;
  let prisma: {
    jobAttempt: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const attempt = {
    id: 'attempt-1',
    jobId: 'job-1',
    attemptNumber: 1,
    status: JobAttemptStatus.PROCESSING,
    errorMessage: null,
    startedAt: new Date('2026-07-16T10:00:01.000Z'),
    completedAt: null,
    processingTimeMs: null,
    createdAt: new Date('2026-07-16T10:00:01.000Z'),
    updatedAt: new Date('2026-07-16T10:00:01.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      jobAttempt: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobAttemptRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repository = module.get(JobAttemptRepository);
  });

  describe('startAttempt', () => {
    it('creates a processing attempt when absent', async () => {
      const startedAt = new Date('2026-07-16T10:00:01.000Z');
      prisma.jobAttempt.findUnique.mockResolvedValue(null);
      prisma.jobAttempt.upsert.mockResolvedValue(attempt);

      await expect(
        repository.startAttempt('job-1', 1, startedAt),
      ).resolves.toEqual(attempt);

      expect(prisma.jobAttempt.upsert).toHaveBeenCalledWith({
        where: { jobId_attemptNumber: { jobId: 'job-1', attemptNumber: 1 } },
        create: {
          job: { connect: { id: 'job-1' } },
          attemptNumber: 1,
          status: JobAttemptStatus.PROCESSING,
          startedAt,
        },
        update: {
          status: JobAttemptStatus.PROCESSING,
          startedAt,
        },
      });
    });

    it('reuses an existing processing attempt without creating duplicates', async () => {
      const startedAt = new Date('2026-07-16T10:00:05.000Z');
      prisma.jobAttempt.findUnique.mockResolvedValue(attempt);
      prisma.jobAttempt.upsert.mockResolvedValue(attempt);

      await repository.startAttempt('job-1', 1, startedAt);

      expect(prisma.jobAttempt.upsert).toHaveBeenCalledWith({
        where: { jobId_attemptNumber: { jobId: 'job-1', attemptNumber: 1 } },
        create: {
          job: { connect: { id: 'job-1' } },
          attemptNumber: 1,
          status: JobAttemptStatus.PROCESSING,
          startedAt,
        },
        update: {
          status: JobAttemptStatus.PROCESSING,
        },
      });
    });

    it('rejects redelivery when the attempt is already completed', async () => {
      prisma.jobAttempt.findUnique.mockResolvedValue({
        ...attempt,
        status: JobAttemptStatus.COMPLETED,
      });

      await expect(
        repository.startAttempt('job-1', 1, new Date()),
      ).rejects.toThrow(AttemptConsistencyError);

      expect(prisma.jobAttempt.upsert).not.toHaveBeenCalled();
    });

    it('rejects redelivery when the attempt is already failed', async () => {
      prisma.jobAttempt.findUnique.mockResolvedValue({
        ...attempt,
        status: JobAttemptStatus.FAILED,
      });

      await expect(
        repository.startAttempt('job-1', 1, new Date()),
      ).rejects.toThrow(AttemptConsistencyError);

      expect(prisma.jobAttempt.upsert).not.toHaveBeenCalled();
    });
  });

  describe('markAttemptCompleted', () => {
    it('updates attempt completion fields', async () => {
      const completedAt = new Date('2026-07-16T10:00:02.000Z');
      const completedAttempt = {
        ...attempt,
        status: JobAttemptStatus.COMPLETED,
        completedAt,
        processingTimeMs: 1000,
      };

      prisma.jobAttempt.update.mockResolvedValue(completedAttempt);

      await expect(
        repository.markAttemptCompleted('job-1', 1, completedAt, 1000),
      ).resolves.toEqual(completedAttempt);

      expect(prisma.jobAttempt.update).toHaveBeenCalledWith({
        where: { jobId_attemptNumber: { jobId: 'job-1', attemptNumber: 1 } },
        data: {
          status: JobAttemptStatus.COMPLETED,
          completedAt,
          processingTimeMs: 1000,
          errorMessage: null,
        },
      });
    });
  });

  describe('markAttemptFailed', () => {
    it('updates attempt failure fields', async () => {
      const completedAt = new Date('2026-07-16T10:00:02.000Z');
      const failedAttempt = {
        ...attempt,
        status: JobAttemptStatus.FAILED,
        completedAt,
        processingTimeMs: 1000,
        errorMessage: 'Simulated failure',
      };

      prisma.jobAttempt.update.mockResolvedValue(failedAttempt);

      await expect(
        repository.markAttemptFailed(
          'job-1',
          1,
          completedAt,
          1000,
          'Simulated failure',
        ),
      ).resolves.toEqual(failedAttempt);

      expect(prisma.jobAttempt.update).toHaveBeenCalledWith({
        where: { jobId_attemptNumber: { jobId: 'job-1', attemptNumber: 1 } },
        data: {
          status: JobAttemptStatus.FAILED,
          completedAt,
          processingTimeMs: 1000,
          errorMessage: 'Simulated failure',
        },
      });
    });
  });

  describe('findByJobId', () => {
    it('returns attempts ordered by attemptNumber ascending', async () => {
      const secondAttempt = { ...attempt, id: 'attempt-2', attemptNumber: 2 };
      const attempts = [attempt, secondAttempt];

      prisma.jobAttempt.findMany.mockResolvedValue(attempts);

      await expect(repository.findByJobId('job-1')).resolves.toEqual(attempts);
      expect(prisma.jobAttempt.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job-1' },
        orderBy: { attemptNumber: 'asc' },
      });
    });
  });

  describe('findLatestAttempt', () => {
    it('returns the latest attempt for a job', async () => {
      prisma.jobAttempt.findFirst.mockResolvedValue(attempt);

      await expect(repository.findLatestAttempt('job-1')).resolves.toEqual(
        attempt,
      );
      expect(prisma.jobAttempt.findFirst).toHaveBeenCalledWith({
        where: { jobId: 'job-1' },
        orderBy: { attemptNumber: 'desc' },
      });
    });

    it('returns null when no attempts exist', async () => {
      prisma.jobAttempt.findFirst.mockResolvedValue(null);

      await expect(repository.findLatestAttempt('job-1')).resolves.toBeNull();
    });
  });
});
