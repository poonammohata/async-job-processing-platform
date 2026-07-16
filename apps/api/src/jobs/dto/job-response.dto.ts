import { ApiProperty } from '@nestjs/swagger';
import { JobAttemptResponseDto } from './job-attempt-response.dto';

export class JobResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'EMAIL' })
  type!: string;

  @ApiProperty({ example: 'NORMAL' })
  priority!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: 0 })
  retryCount!: number;

  @ApiProperty({ example: 3 })
  maxAttempts!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { to: 'john@example.com' },
  })
  payload!: unknown;

  @ApiProperty({ nullable: true, example: null })
  delayMs!: number | null;

  @ApiProperty({ nullable: true, example: null })
  runAt!: string | null;

  @ApiProperty({ example: '2026-07-16T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: '2026-07-16T10:00:01.000Z' })
  startedAt!: string | null;

  @ApiProperty({ nullable: true, example: '2026-07-16T10:00:02.000Z' })
  completedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  failedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  cancelledAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  lastError!: string | null;

  @ApiProperty({ nullable: true, example: 1000 })
  processingTimeMs!: number | null;

  @ApiProperty({ example: '2026-07-16T10:00:02.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: [JobAttemptResponseDto] })
  attempts!: JobAttemptResponseDto[];
}
