import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { RedisConnectionService } from '../../queue/redis-connection.service';
import { WORKER_HEARTBEAT_KEY } from '../../worker/worker-heartbeat.constants';
import { HealthService } from '../health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };
  let redis: {
    ping: jest.Mock;
    get: jest.Mock;
  };
  let queueService: { getJobCounts: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(Date.now().toString()),
    };
    queueService = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 1,
        delayed: 0,
        completed: 42,
        failed: 3,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RedisConnectionService,
          useValue: {
            getConnection: () => redis,
          },
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'worker') {
                return { heartbeatTtlMs: 15000 };
              }

              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok when all dependencies are healthy', async () => {
    const result = await service.getHealth();

    expect(result).toEqual({
      status: 'ok',
      workerRunning: true,
      database: 'connected',
      redis: 'connected',
      queue: {
        waiting: 0,
        active: 1,
        delayed: 0,
        completed: 42,
        failed: 3,
      },
    });
    expect(redis.get).toHaveBeenCalledWith(WORKER_HEARTBEAT_KEY);
  });

  it('returns degraded when the worker heartbeat is missing', async () => {
    redis.get.mockResolvedValue(null);

    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.workerRunning).toBe(false);
    expect(result.database).toBe('connected');
    expect(result.redis).toBe('connected');
  });

  it('returns degraded when the worker heartbeat is stale', async () => {
    redis.get.mockResolvedValue((Date.now() - 20000).toString());

    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.workerRunning).toBe(false);
  });

  it('returns down when the database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));

    const result = await service.getHealth();

    expect(result.status).toBe('down');
    expect(result.database).toBe('disconnected');
  });

  it('returns down when redis is unavailable', async () => {
    redis.ping.mockRejectedValue(new Error('redis down'));

    const result = await service.getHealth();

    expect(result.status).toBe('down');
    expect(result.redis).toBe('disconnected');
  });
});
