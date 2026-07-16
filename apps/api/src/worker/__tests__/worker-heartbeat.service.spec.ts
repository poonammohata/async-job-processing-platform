import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JOB_WORKER_CONNECTION_TOKEN } from '../../queue/queue.constants';
import { WORKER_HEARTBEAT_KEY } from '../worker-heartbeat.constants';
import { WorkerHeartbeatService } from '../worker-heartbeat.service';

describe('WorkerHeartbeatService', () => {
  let service: WorkerHeartbeatService;
  let redis: {
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerHeartbeatService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'worker') {
                return {
                  heartbeatIntervalMs: 5000,
                  heartbeatTtlMs: 15000,
                };
              }

              return undefined;
            }),
          },
        },
        {
          provide: JOB_WORKER_CONNECTION_TOKEN,
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get(WorkerHeartbeatService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('writes an initial heartbeat on startup', () => {
    service.onModuleInit();

    expect(redis.set).toHaveBeenCalledWith(
      WORKER_HEARTBEAT_KEY,
      expect.any(String),
      'PX',
      15000,
    );
  });

  it('refreshes the heartbeat on interval', () => {
    service.onModuleInit();
    redis.set.mockClear();

    jest.advanceTimersByTime(5000);

    expect(redis.set).toHaveBeenCalledWith(
      WORKER_HEARTBEAT_KEY,
      expect.any(String),
      'PX',
      15000,
    );
  });

  it('deletes the heartbeat key on shutdown', async () => {
    service.onModuleInit();
    await service.onModuleDestroy();

    expect(redis.del).toHaveBeenCalledWith(WORKER_HEARTBEAT_KEY);
  });

  it('clears the heartbeat interval on shutdown', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    service.onModuleInit();
    redis.set.mockClear();

    await service.onModuleDestroy();
    jest.advanceTimersByTime(5000);

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
