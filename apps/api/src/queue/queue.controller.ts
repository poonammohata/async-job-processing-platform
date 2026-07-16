import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  QueueManagementService,
  QueuePauseResponse,
  QueueResumeResponse,
} from './queue-management.service';

@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueManagementService: QueueManagementService,
  ) {}

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  pause(): Promise<QueuePauseResponse> {
    return this.queueManagementService.pause();
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  resume(): Promise<QueueResumeResponse> {
    return this.queueManagementService.resume();
  }
}
