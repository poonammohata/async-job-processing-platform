import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { AppConfigModule } from '../config/config.module';
import { AppConfiguration } from '../config/configuration';
import {
  JOB_QUEUE_CONNECTION_TOKEN,
  JOB_QUEUE_TOKEN,
} from './queue.constants';
import { QueueJobData } from './queue.types';
import { QueueService } from './queue.service';
import { RedisConnectionService } from './redis-connection.service';

@Module({
  imports: [AppConfigModule],
  providers: [
    RedisConnectionService,
    {
      provide: JOB_QUEUE_CONNECTION_TOKEN,
      useFactory: (redisConnectionService: RedisConnectionService) =>
        redisConnectionService.getConnection(),
      inject: [RedisConnectionService],
    },
    {
      provide: JOB_QUEUE_TOKEN,
      useFactory: (
        configService: ConfigService<AppConfiguration, true>,
        connection: Redis,
      ) => {
        const queueConfig = configService.get('queue', { infer: true });

        return new Queue<QueueJobData>(queueConfig.name, {
          connection,
          defaultJobOptions: {
            attempts: queueConfig.maxAttempts,
            backoff: {
              type: 'exponential',
              delay: queueConfig.backoffDelayMs,
            },
            removeOnComplete: false,
            removeOnFail: false,
          },
        });
      },
      inject: [ConfigService, JOB_QUEUE_CONNECTION_TOKEN],
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
