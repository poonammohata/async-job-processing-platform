import { Controller, Get } from '@nestjs/common';
import { MetricsResponseDto } from './dto/metrics-response.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getMetrics(): Promise<MetricsResponseDto> {
    return this.metricsService.getMetrics();
  }
}
