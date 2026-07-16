export type HealthStatus = 'ok' | 'degraded' | 'down';

export type DependencyConnectionStatus = 'connected' | 'disconnected';

export class HealthQueueCountsDto {
  waiting!: number;
  active!: number;
  delayed!: number;
  completed!: number;
  failed!: number;
}

export class HealthResponseDto {
  status!: HealthStatus;
  workerRunning!: boolean;
  database!: DependencyConnectionStatus;
  redis!: DependencyConnectionStatus;
  queue!: HealthQueueCountsDto;
}
