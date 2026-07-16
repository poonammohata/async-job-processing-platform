import { Injectable } from '@nestjs/common';
import { QueueService } from './queue.service';

export interface QueuePauseResponse {
  status: 'paused';
}

export interface QueueResumeResponse {
  status: 'running';
}

@Injectable()
export class QueueManagementService {
  constructor(private readonly queueService: QueueService) {}

  async pause(): Promise<QueuePauseResponse> {
    await this.queueService.pause();
    return { status: 'paused' };
  }

  async resume(): Promise<QueueResumeResponse> {
    await this.queueService.resume();
    return { status: 'running' };
  }
}
