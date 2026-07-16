import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from '../metrics.controller';
import { MetricsService } from '../metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { getMetrics: jest.Mock };

  beforeEach(async () => {
    metricsService = {
      getMetrics: jest.fn().mockResolvedValue({
        jobsProcessed: 120,
        completedJobs: 110,
        failedJobs: 10,
        queueLength: 8,
        activeJobs: 2,
        averageProcessingTimeMs: 842,
        successRate: 91.67,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    }).compile();

    controller = module.get(MetricsController);
  });

  it('GET /metrics delegates to MetricsService', async () => {
    await expect(controller.getMetrics()).resolves.toEqual({
      jobsProcessed: 120,
      completedJobs: 110,
      failedJobs: 10,
      queueLength: 8,
      activeJobs: 2,
      averageProcessingTimeMs: 842,
      successRate: 91.67,
    });
    expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
  });
});
