import { ApiProperty } from '@nestjs/swagger';

export class MetricsResponseDto {
  @ApiProperty({ example: 120 })
  jobsProcessed!: number;

  @ApiProperty({ example: 110 })
  completedJobs!: number;

  @ApiProperty({ example: 10 })
  failedJobs!: number;

  @ApiProperty({ example: 8 })
  queueLength!: number;

  @ApiProperty({ example: 2 })
  activeJobs!: number;

  @ApiProperty({ example: 842 })
  averageProcessingTimeMs!: number;

  @ApiProperty({ example: 91.67 })
  successRate!: number;
}
