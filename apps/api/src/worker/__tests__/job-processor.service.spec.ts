import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Job as BullMqJob } from 'bullmq';
import { JobType } from '@prisma/client';
import { JobAttemptRepository } from '../../jobs/repositories/job-attempt.repository';
import { JobRepository } from '../../jobs/repositories/job.repository';
import { QueueJobData } from '../../queue/queue.types';
import { JobProcessorService } from '../job-processor.service';

describe('JobProcessorService', () => {
  let service: JobProcessorService;
  let jobRepository: {
    markProcessing: jest.Mock;
    markCompleted: jest.Mock;
    markRetryQueued: jest.Mock;
    markFailed: jest.Mock;
  };
  let jobAttemptRepository: {
    startAttempt: jest.Mock;
    markAttemptCompleted: jest.Mock;
    markAttemptFailed: jest.Mock;
  };
  let configGet: jest.Mock;
  let logSpy: jest.SpyInstance;

  const jobId = '550e8400-e29b-41d4-a716-446655440000';
  const basePayload = { to: 'john@example.com' };

  const createBullMqJob = (
    overrides: Partial<BullMqJob<QueueJobData>> = {},
  ): BullMqJob<QueueJobData> =>
    ({
      data: {
        jobId,
        type: JobType.EMAIL,
        payload: basePayload,
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
      ...overrides,
    }) as BullMqJob<QueueJobData>;

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    jobRepository = {
      markProcessing: jest.fn().mockResolvedValue({}),
      markCompleted: jest.fn().mockResolvedValue({}),
      markRetryQueued: jest.fn().mockResolvedValue({}),
      markFailed: jest.fn().mockResolvedValue({}),
    };
    jobAttemptRepository = {
      startAttempt: jest.fn().mockResolvedValue({}),
      markAttemptCompleted: jest.fn().mockResolvedValue({}),
      markAttemptFailed: jest.fn().mockResolvedValue({}),
    };
    configGet = jest.fn((key: string) => {
      if (key === 'worker') {
        return { processingDelayMs: 0 };
      }

      if (key === 'queue') {
        return { maxAttempts: 3 };
      }

      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobProcessorService,
        {
          provide: JobRepository,
          useValue: jobRepository,
        },
        {
          provide: JobAttemptRepository,
          useValue: jobAttemptRepository,
        },
        {
          provide: ConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    service = module.get(JobProcessorService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const getProcessingLog = (): Record<string, unknown> | undefined =>
    logSpy.mock.calls
      .map((call) => call[0])
      .find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as { event?: string }).event === 'JOB_PROCESSING',
      ) as Record<string, unknown> | undefined;

  describe('success path', () => {
    it('starts attempt 1, marks parent processing, then completes with retryCount 0', async () => {
      const now = new Date('2026-07-16T10:00:00.000Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await service.process(createBullMqJob());

      expect(jobAttemptRepository.startAttempt).toHaveBeenCalledWith(
        jobId,
        1,
        new Date(now),
      );
      expect(jobRepository.markProcessing).toHaveBeenCalledWith(
        jobId,
        new Date(now),
      );
      expect(jobAttemptRepository.markAttemptCompleted).toHaveBeenCalledWith(
        jobId,
        1,
        new Date(now),
        0,
      );
      expect(jobRepository.markCompleted).toHaveBeenCalledWith(
        jobId,
        expect.any(Date),
        0,
        0,
      );
    });

    it('persists processingTimeMs when processing delay is configured', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'worker') {
          return { processingDelayMs: 1000 };
        }

        if (key === 'queue') {
          return { maxAttempts: 3 };
        }

        return undefined;
      });

      jest.useFakeTimers({
        now: new Date('2026-07-16T10:00:00.000Z'),
      });

      const processPromise = service.process(createBullMqJob());
      await jest.advanceTimersByTimeAsync(1000);
      await processPromise;

      expect(jobAttemptRepository.markAttemptCompleted).toHaveBeenCalledWith(
        jobId,
        1,
        new Date('2026-07-16T10:00:01.000Z'),
        1000,
      );
    });

    it('logs payloadKeys instead of the complete payload for JOB_PROCESSING', async () => {
      await service.process(createBullMqJob());

      expect(getProcessingLog()).toEqual({
        event: 'JOB_PROCESSING',
        jobId,
        type: JobType.EMAIL,
        attemptNumber: 1,
        payloadKeys: ['to'],
      });
      expect(getProcessingLog()).not.toHaveProperty('payload');
    });
  });

  describe('temporary failure', () => {
    it('marks attempt failed, requeues parent, and rethrows', async () => {
      const job = createBullMqJob({
        data: {
          jobId,
          type: JobType.EMAIL,
          payload: { shouldFail: true },
        },
      });

      await expect(service.process(job)).rejects.toThrow(
        'Simulated permanent processing failure',
      );

      expect(jobAttemptRepository.markAttemptFailed).toHaveBeenCalledWith(
        jobId,
        1,
        expect.any(Date),
        expect.any(Number),
        'Simulated permanent processing failure',
      );
      expect(jobRepository.markRetryQueued).toHaveBeenCalledWith(
        jobId,
        1,
        'Simulated permanent processing failure',
      );
      expect(jobRepository.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('success after retries', () => {
    it('sets retryCount to failed attempts on success', async () => {
      const job = createBullMqJob({ attemptsMade: 2 });

      await service.process(job);

      expect(jobAttemptRepository.startAttempt).toHaveBeenCalledWith(
        jobId,
        3,
        expect.any(Date),
      );
      expect(jobRepository.markCompleted).toHaveBeenCalledWith(
        jobId,
        expect.any(Date),
        expect.any(Number),
        2,
      );
    });
  });

  describe('permanent failure', () => {
    it('marks parent failed on final attempt and rethrows', async () => {
      const job = createBullMqJob({
        attemptsMade: 2,
        data: {
          jobId,
          type: JobType.EMAIL,
          payload: { shouldFail: true },
        },
      });

      await expect(service.process(job)).rejects.toThrow(
        'Simulated permanent processing failure',
      );

      expect(jobRepository.markFailed).toHaveBeenCalledWith(
        jobId,
        expect.any(Date),
        'Simulated permanent processing failure',
        3,
      );
      expect(jobRepository.markRetryQueued).not.toHaveBeenCalled();
    });
  });

  describe('failUntilAttempt', () => {
    it('fails while attemptNumber is less than or equal to N and succeeds afterward', async () => {
      const failingJob = createBullMqJob({
        data: {
          jobId,
          type: JobType.EMAIL,
          payload: { failUntilAttempt: 2 },
        },
      });

      await expect(service.process(failingJob)).rejects.toThrow(
        'Simulated failure on attempt 1',
      );

      const succeedingJob = createBullMqJob({
        attemptsMade: 2,
        data: {
          jobId,
          type: JobType.EMAIL,
          payload: { failUntilAttempt: 2 },
        },
      });

      await service.process(succeedingJob);

      expect(jobRepository.markCompleted).toHaveBeenCalledWith(
        jobId,
        expect.any(Date),
        expect.any(Number),
        2,
      );
    });
  });

  describe('sanitization', () => {
    it('persists sanitized error messages without stack traces', async () => {
      const job = createBullMqJob({
        data: {
          jobId,
          type: JobType.EMAIL,
          payload: { shouldFail: true },
        },
      });

      await expect(service.process(job)).rejects.toThrow();

      expect(jobAttemptRepository.markAttemptFailed).toHaveBeenCalledWith(
        jobId,
        1,
        expect.any(Date),
        expect.any(Number),
        expect.not.stringContaining('at Object'),
      );
    });
  });

  describe('completion persistence errors', () => {
    it('does not treat markAttemptCompleted failures as simulated processing failures', async () => {
      const persistenceError = new Error('database write failed');
      jobAttemptRepository.markAttemptCompleted.mockRejectedValue(
        persistenceError,
      );

      await expect(service.process(createBullMqJob())).rejects.toThrow(
        persistenceError,
      );

      expect(jobAttemptRepository.markAttemptFailed).not.toHaveBeenCalled();
      expect(jobRepository.markRetryQueued).not.toHaveBeenCalled();
      expect(jobRepository.markFailed).not.toHaveBeenCalled();
    });

    it('does not treat markCompleted failures as simulated processing failures', async () => {
      const persistenceError = new Error('database write failed');
      jobRepository.markCompleted.mockRejectedValue(persistenceError);

      await expect(service.process(createBullMqJob())).rejects.toThrow(
        persistenceError,
      );

      expect(jobAttemptRepository.markAttemptFailed).not.toHaveBeenCalled();
      expect(jobRepository.markRetryQueued).not.toHaveBeenCalled();
      expect(jobRepository.markFailed).not.toHaveBeenCalled();
    });
  });
});
