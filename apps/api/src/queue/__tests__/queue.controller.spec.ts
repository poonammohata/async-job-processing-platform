import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from '../queue.controller';
import { QueueManagementService } from '../queue-management.service';

describe('QueueController', () => {
  let controller: QueueController;
  let queueManagementService: {
    pause: jest.Mock;
    resume: jest.Mock;
  };

  beforeEach(async () => {
    queueManagementService = {
      pause: jest.fn().mockResolvedValue({ status: 'paused' }),
      resume: jest.fn().mockResolvedValue({ status: 'running' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueManagementService,
          useValue: queueManagementService,
        },
      ],
    }).compile();

    controller = module.get(QueueController);
  });

  it('POST /queue/pause delegates to QueueManagementService', async () => {
    await expect(controller.pause()).resolves.toEqual({ status: 'paused' });
    expect(queueManagementService.pause).toHaveBeenCalledTimes(1);
  });

  it('POST /queue/resume delegates to QueueManagementService', async () => {
    await expect(controller.resume()).resolves.toEqual({ status: 'running' });
    expect(queueManagementService.resume).toHaveBeenCalledTimes(1);
  });
});
