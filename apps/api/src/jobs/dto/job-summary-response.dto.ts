import { ApiProperty } from '@nestjs/swagger';

export class JobSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'EMAIL' })
  type!: string;

  @ApiProperty({ example: 'NORMAL' })
  priority!: string;

  @ApiProperty({ example: 'QUEUED' })
  status!: string;

  @ApiProperty({ example: 0 })
  retryCount!: number;

  @ApiProperty({ example: 3 })
  maxAttempts!: number;

  @ApiProperty({ example: '2026-07-16T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: null })
  startedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  completedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  failedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  cancelledAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  lastError!: string | null;

  @ApiProperty({ nullable: true, example: null })
  processingTimeMs!: number | null;

  @ApiProperty({ example: '2026-07-16T10:00:00.000Z' })
  updatedAt!: string;
}
