import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AppConfiguration } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RedisConnectionService } from '../queue/redis-connection.service';
import { WORKER_HEARTBEAT_KEY } from '../worker/worker-heartbeat.constants';
import {
  DependencyConnectionStatus,
  HealthResponseDto,
  HealthStatus,
} from './dto/health-response.dto';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisConnectionService: RedisConnectionService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {}

  async getHealth(): Promise<HealthResponseDto> {
    const [database, redis, queue] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.getQueueCounts(),
    ]);

    const workerRunning =
      redis === 'connected' ? await this.checkWorkerRunning() : false;
    const status = this.resolveStatus(database, redis, workerRunning);

    return {
      status,
      workerRunning,
      database,
      redis,
      queue,
    };
  }

  private async checkDatabase(): Promise<DependencyConnectionStatus> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private async checkRedis(): Promise<DependencyConnectionStatus> {
    try {
      const response = await this.redisConnectionService.getConnection().ping();
      return response === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  private async checkWorkerRunning(): Promise<boolean> {
    try {
      const heartbeat = await this.redisConnectionService
        .getConnection()
        .get(WORKER_HEARTBEAT_KEY);

      if (heartbeat === null) {
        return false;
      }

      const heartbeatAgeMs = Date.now() - Number(heartbeat);
      const ttlMs = this.configService.get('worker', { infer: true }).heartbeatTtlMs;

      return heartbeatAgeMs < ttlMs;
    } catch {
      return false;
    }
  }

  private async getQueueCounts(): Promise<HealthResponseDto['queue']> {
    try {
      return await this.queueService.getJobCounts();
    } catch {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      };
    }
  }

  private resolveStatus(
    database: DependencyConnectionStatus,
    redis: DependencyConnectionStatus,
    workerRunning: boolean,
  ): HealthStatus {
    if (database === 'disconnected' || redis === 'disconnected') {
      return 'down';
    }

    if (!workerRunning) {
      return 'degraded';
    }

    return 'ok';
  }
}
