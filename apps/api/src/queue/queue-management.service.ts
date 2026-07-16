import { Injectable } from '@nestjs/common';
import { QueuePauseResponseDto } from './dto/queue-pause-response.dto';
import { QueueResumeResponseDto } from './dto/queue-resume-response.dto';
import { QueueService } from './queue.service';

@Injectable()
export class QueueManagementService {
  constructor(private readonly queueService: QueueService) {}

  async pause(): Promise<QueuePauseResponseDto> {
    await this.queueService.pause();
    return { status: 'paused' };
  }

  async resume(): Promise<QueueResumeResponseDto> {
    await this.queueService.resume();
    return { status: 'running' };
  }
}
