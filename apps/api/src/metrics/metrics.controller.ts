import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricsResponseDto } from './dto/metrics-response.dto';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get historical PostgreSQL metrics and live BullMQ queue metrics',
  })
  @ApiResponse({ status: 200, type: MetricsResponseDto })
  @ApiResponse({ status: 500, description: 'Unexpected server error' })
  getMetrics(): Promise<MetricsResponseDto> {
    return this.metricsService.getMetrics();
  }
}
