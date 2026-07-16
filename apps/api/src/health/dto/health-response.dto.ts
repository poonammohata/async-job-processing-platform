import { ApiProperty } from '@nestjs/swagger';

export class HealthQueueCountsDto {
  @ApiProperty({ example: 0 })
  waiting!: number;

  @ApiProperty({ example: 1 })
  active!: number;

  @ApiProperty({ example: 0 })
  delayed!: number;

  @ApiProperty({ example: 42 })
  completed!: number;

  @ApiProperty({ example: 3 })
  failed!: number;
}

export type HealthStatus = 'ok' | 'degraded' | 'down';

export type DependencyConnectionStatus = 'connected' | 'disconnected';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded', 'down'], example: 'ok' })
  status!: HealthStatus;

  @ApiProperty({ example: true })
  workerRunning!: boolean;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  database!: DependencyConnectionStatus;

  @ApiProperty({ enum: ['connected', 'disconnected'], example: 'connected' })
  redis!: DependencyConnectionStatus;

  @ApiProperty({ type: HealthQueueCountsDto })
  queue!: HealthQueueCountsDto;
}
