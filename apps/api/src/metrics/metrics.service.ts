import { Injectable } from '@nestjs/common';
import { JobRepository } from '../jobs/repositories/job.repository';
import { QueueService } from '../queue/queue.service';
import { MetricsResponseDto } from './dto/metrics-response.dto';

@Injectable()
export class MetricsService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly queueService: QueueService,
  ) {}

  async getMetrics(): Promise<MetricsResponseDto> {
    const [
      completedJobs,
      failedJobs,
      averageProcessingTimeMs,
      queueCounts,
    ] = await Promise.all([
      this.jobRepository.countCompletedJobs(),
      this.jobRepository.countFailedJobs(),
      this.jobRepository.averageProcessingTimeMs(),
      this.queueService.getJobCounts(),
    ]);

    const jobsProcessed = completedJobs + failedJobs;
    const successRate =
      jobsProcessed === 0
        ? 0
        : Number(((completedJobs / jobsProcessed) * 100).toFixed(2));

    return {
      jobsProcessed,
      completedJobs,
      failedJobs,
      queueLength: queueCounts.waiting,
      activeJobs: queueCounts.active,
      averageProcessingTimeMs: averageProcessingTimeMs ?? 0,
      successRate,
    };
  }
}
