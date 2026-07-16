import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '../queue.service';
import { QueueManagementService } from '../queue-management.service';

describe('QueueManagementService', () => {
  let service: QueueManagementService;
  let queueService: {
    pause: jest.Mock;
    resume: jest.Mock;
  };

  beforeEach(async () => {
    queueService = {
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueManagementService,
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    service = module.get(QueueManagementService);
  });

  describe('pause', () => {
    it('pauses the queue and returns paused status', async () => {
      await expect(service.pause()).resolves.toEqual({ status: 'paused' });
      expect(queueService.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('resume', () => {
    it('resumes the queue and returns running status', async () => {
      await expect(service.resume()).resolves.toEqual({ status: 'running' });
      expect(queueService.resume).toHaveBeenCalledTimes(1);
    });
  });
});
