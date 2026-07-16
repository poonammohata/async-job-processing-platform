import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfiguration } from '../config/configuration';
import { JOB_WORKER_CONNECTION_TOKEN } from '../queue/queue.constants';
import { WORKER_HEARTBEAT_KEY } from './worker-heartbeat.constants';

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
    @Inject(JOB_WORKER_CONNECTION_TOKEN)
    private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    const workerConfig = this.configService.get('worker', { infer: true });
    void this.refreshHeartbeat(workerConfig.heartbeatTtlMs);

    this.interval = setInterval(() => {
      void this.refreshHeartbeat(workerConfig.heartbeatTtlMs);
    }, workerConfig.heartbeatIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    await this.redis.del(WORKER_HEARTBEAT_KEY);
  }

  async refreshHeartbeat(ttlMs: number): Promise<void> {
    if (this.stopped) {
      return;
    }

    const timestamp = Date.now().toString();
    await this.redis.set(WORKER_HEARTBEAT_KEY, timestamp, 'PX', ttlMs);
  }
}
