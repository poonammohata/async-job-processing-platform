export class MetricsResponseDto {
  jobsProcessed!: number;
  completedJobs!: number;
  failedJobs!: number;
  queueLength!: number;
  activeJobs!: number;
  averageProcessingTimeMs!: number;
  successRate!: number;
}
