import { ApiProperty } from '@nestjs/swagger';

export class JobAttemptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  attemptNumber!: number;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ nullable: true, example: null })
  errorMessage!: string | null;

  @ApiProperty({ example: '2026-07-16T10:00:01.000Z' })
  startedAt!: string;

  @ApiProperty({ nullable: true, example: '2026-07-16T10:00:02.000Z' })
  completedAt!: string | null;

  @ApiProperty({ nullable: true, example: 1000 })
  processingTimeMs!: number | null;

  @ApiProperty({ example: '2026-07-16T10:00:01.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-16T10:00:02.000Z' })
  updatedAt!: string;
}
