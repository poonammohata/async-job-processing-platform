import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const health = await this.healthService.getHealth();

    if (health.status === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
