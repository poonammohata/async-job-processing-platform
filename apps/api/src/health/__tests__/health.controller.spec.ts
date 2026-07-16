import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { getHealth: jest.Mock };

  beforeEach(async () => {
    healthService = {
      getHealth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns 200 for ok status', async () => {
    healthService.getHealth.mockResolvedValue({
      status: 'ok',
      workerRunning: true,
      database: 'connected',
      redis: 'connected',
      queue: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      },
    });

    const res = { status: jest.fn() } as unknown as Response;

    await expect(controller.getHealth(res)).resolves.toMatchObject({
      status: 'ok',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 for down status', async () => {
    healthService.getHealth.mockResolvedValue({
      status: 'down',
      workerRunning: false,
      database: 'disconnected',
      redis: 'connected',
      queue: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      },
    });

    const res = { status: jest.fn() } as unknown as Response;

    await controller.getHealth(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
