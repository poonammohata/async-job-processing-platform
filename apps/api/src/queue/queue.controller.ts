import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueuePauseResponseDto } from './dto/queue-pause-response.dto';
import { QueueResumeResponseDto } from './dto/queue-resume-response.dto';
import { QueueManagementService } from './queue-management.service';

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueManagementService: QueueManagementService,
  ) {}

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause waiting jobs; active jobs continue to completion',
  })
  @ApiResponse({ status: 200, type: QueuePauseResponseDto })
  @ApiResponse({ status: 503, description: 'Queue unavailable' })
  @ApiResponse({ status: 500, description: 'Unexpected server error' })
  pause(): Promise<QueuePauseResponseDto> {
    return this.queueManagementService.pause();
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume assignment of waiting jobs to workers' })
  @ApiResponse({ status: 200, type: QueueResumeResponseDto })
  @ApiResponse({ status: 503, description: 'Queue unavailable' })
  @ApiResponse({ status: 500, description: 'Unexpected server error' })
  resume(): Promise<QueueResumeResponseDto> {
    return this.queueManagementService.resume();
  }
}
