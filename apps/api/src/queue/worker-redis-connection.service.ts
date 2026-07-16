import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConnectionService } from './redis-connection.service';

@Injectable()
export class WorkerRedisConnectionService implements OnModuleDestroy {
  private readonly connection: Redis;
  private closed = false;

  constructor(redisConnectionService: RedisConnectionService) {
    this.connection = redisConnectionService.createConnection();
  }

  getConnection(): Redis {
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.connection.quit();
    this.closed = true;
  }
}
