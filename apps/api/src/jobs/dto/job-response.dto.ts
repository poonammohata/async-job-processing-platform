import { JobAttemptResponseDto } from './job-attempt-response.dto';

export class JobResponseDto {
  id!: string;
  type!: string;
  priority!: string;
  status!: string;
  retryCount!: number;
  maxAttempts!: number;
  payload!: unknown;
  delayMs!: number | null;
  runAt!: string | null;
  createdAt!: string;
  startedAt!: string | null;
  completedAt!: string | null;
  failedAt!: string | null;
  cancelledAt!: string | null;
  lastError!: string | null;
  processingTimeMs!: number | null;
  updatedAt!: string;
  attempts!: JobAttemptResponseDto[];
}
