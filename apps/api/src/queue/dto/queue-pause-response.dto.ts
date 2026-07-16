import { ApiProperty } from '@nestjs/swagger';

export class QueuePauseResponseDto {
  @ApiProperty({ example: 'paused', enum: ['paused'] })
  status!: 'paused';
}
