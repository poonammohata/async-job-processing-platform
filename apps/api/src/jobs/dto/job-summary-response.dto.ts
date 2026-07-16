export class JobSummaryResponseDto {
  id!: string;
  type!: string;
  priority!: string;
  status!: string;
  retryCount!: number;
  maxAttempts!: number;
  createdAt!: string;
  startedAt!: string | null;
  completedAt!: string | null;
  failedAt!: string | null;
  cancelledAt!: string | null;
  lastError!: string | null;
  processingTimeMs!: number | null;
  updatedAt!: string;
}
