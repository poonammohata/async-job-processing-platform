import { Test, TestingModule } from '@nestjs/testing';
import { JobPriority, JobType } from '@prisma/client';
import { DeadLetterJobsController } from '../dead-letter-jobs.controller';
import { JobsService } from '../jobs.service';

describe('DeadLetterJobsController', () => {
  let controller: DeadLetterJobsController;
  let jobsService: {
    listDeadLetterJobs: jest.Mock;
  };

  beforeEach(async () => {
    jobsService = {
      listDeadLetterJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeadLetterJobsController],
      providers: [
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    }).compile();

    controller = module.get(DeadLetterJobsController);
  });

  it('delegates GET /dead-letter-jobs to JobsService.listDeadLetterJobs', async () => {
    const response = {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    };
    jobsService.listDeadLetterJobs.mockResolvedValue(response);

    await expect(
      controller.listDeadLetterJobs({
        page: 1,
        pageSize: 20,
        type: JobType.EMAIL,
        priority: JobPriority.NORMAL,
        sortBy: 'failedAt',
        order: 'desc',
      }),
    ).resolves.toEqual(response);

    expect(jobsService.listDeadLetterJobs).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      type: JobType.EMAIL,
      priority: JobPriority.NORMAL,
      sortBy: 'failedAt',
      order: 'desc',
    });
  });
});
