import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { AppConfiguration } from '../config/configuration';

@Injectable()
export class RedisConnectionService implements OnModuleDestroy {
  private readonly connection: Redis;
  private closed = false;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {
    this.connection = this.createConnection();
  }

  getConnection(): Redis {
    return this.connection;
  }

  /**
   * BullMQ Workers require a dedicated Redis connection because they use
   * blocking commands and must not share the Queue producer connection.
   */
  createConnection(): Redis {
    const redisConfig = this.configService.get('redis', { infer: true });
    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      maxRetriesPerRequest: null,
    };

    if (redisConfig.password) {
      options.password = redisConfig.password;
    }

    return new Redis(options);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.connection.quit();
    this.closed = true;
  }
}
