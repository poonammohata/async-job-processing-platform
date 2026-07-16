import { Test, TestingModule } from '@nestjs/testing';
import { JobAttemptStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobAttemptRepository } from '../job-attempt.repository';

describe('JobAttemptRepository', () => {
  let repository: JobAttemptRepository;
  let prisma: {
    jobAttempt: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
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
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
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

  describe('createAttempt', () => {
    it('creates a job attempt', async () => {
      const data: Prisma.JobAttemptCreateInput = {
        attemptNumber: 1,
        status: JobAttemptStatus.PROCESSING,
        job: { connect: { id: 'job-1' } },
      };

      prisma.jobAttempt.create.mockResolvedValue(attempt);

      await expect(repository.createAttempt(data)).resolves.toEqual(attempt);
      expect(prisma.jobAttempt.create).toHaveBeenCalledWith({ data });
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
