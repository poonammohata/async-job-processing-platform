import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { AppConfiguration } from '../../config/configuration';
import { RedisConnectionService } from '../redis-connection.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('RedisConnectionService', () => {
  const mockedRedis = Redis as unknown as jest.Mock;

  beforeEach(() => {
    mockedRedis.mockClear();
  });

  async function createService(
    redisConfig: AppConfiguration['redis'],
  ): Promise<RedisConnectionService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisConnectionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(redisConfig),
          },
        },
      ],
    }).compile();

    return module.get(RedisConnectionService);
  }

  it('omits password when empty and sets maxRetriesPerRequest to null', async () => {
    await createService({
      host: 'localhost',
      port: 6379,
    });

    expect(mockedRedis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it('includes password when configured', async () => {
    await createService({
      host: 'localhost',
      port: 6379,
      password: 'secret',
    });

    expect(mockedRedis).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
      password: 'secret',
      maxRetriesPerRequest: null,
    });
  });

  it('closes the connection on module destroy', async () => {
    const service = await createService({
      host: 'localhost',
      port: 6379,
    });
    const connection = service.getConnection();

    await service.onModuleDestroy();
    await service.onModuleDestroy();

    expect(connection.quit).toHaveBeenCalledTimes(1);
  });

  it('does not mark closed when quit rejects and allows retry', async () => {
    const service = await createService({
      host: 'localhost',
      port: 6379,
    });
    const connection = service.getConnection();

    (connection.quit as jest.Mock)
      .mockRejectedValueOnce(new Error('quit failed'))
      .mockResolvedValueOnce('OK');

    await expect(service.onModuleDestroy()).rejects.toThrow('quit failed');
    await service.onModuleDestroy();

    expect(connection.quit).toHaveBeenCalledTimes(2);
  });
});
