export class JobAttemptResponseDto {
  id!: string;
  attemptNumber!: number;
  status!: string;
  errorMessage!: string | null;
  startedAt!: string;
  completedAt!: string | null;
  processingTimeMs!: number | null;
  createdAt!: string;
  updatedAt!: string;
}
