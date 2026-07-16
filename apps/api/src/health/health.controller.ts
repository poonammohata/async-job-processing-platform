import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API, database, Redis, worker, and queue health' })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @ApiResponse({
    status: 503,
    description: 'Critical dependency unavailable',
    type: HealthResponseDto,
  })
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const health = await this.healthService.getHealth();

    if (health.status === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
