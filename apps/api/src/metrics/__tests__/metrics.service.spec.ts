import { Test, TestingModule } from '@nestjs/testing';
import { JobRepository } from '../../jobs/repositories/job.repository';
import { QueueService } from '../../queue/queue.service';
import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let jobRepository: {
    countCompletedJobs: jest.Mock;
    countFailedJobs: jest.Mock;
    averageProcessingTimeMs: jest.Mock;
  };
  let queueService: { getJobCounts: jest.Mock };

  beforeEach(async () => {
    jobRepository = {
      countCompletedJobs: jest.fn().mockResolvedValue(110),
      countFailedJobs: jest.fn().mockResolvedValue(10),
      averageProcessingTimeMs: jest.fn().mockResolvedValue(842),
    };
    queueService = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 8,
        active: 2,
        delayed: 0,
        completed: 110,
        failed: 10,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: JobRepository,
          useValue: jobRepository,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    service = module.get(MetricsService);
  });

  it('combines PostgreSQL historical metrics with live BullMQ counts', async () => {
    const result = await service.getMetrics();

    expect(result).toEqual({
      jobsProcessed: 120,
      completedJobs: 110,
      failedJobs: 10,
      queueLength: 8,
      activeJobs: 2,
      averageProcessingTimeMs: 842,
      successRate: 91.67,
    });
  });

  it('returns zero success rate when no jobs have been processed', async () => {
    jobRepository.countCompletedJobs.mockResolvedValue(0);
    jobRepository.countFailedJobs.mockResolvedValue(0);
    jobRepository.averageProcessingTimeMs.mockResolvedValue(null);

    const result = await service.getMetrics();

    expect(result.jobsProcessed).toBe(0);
    expect(result.successRate).toBe(0);
    expect(result.averageProcessingTimeMs).toBe(0);
  });
});
