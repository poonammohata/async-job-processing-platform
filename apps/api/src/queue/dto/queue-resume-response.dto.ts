import { ApiProperty } from '@nestjs/swagger';

export class QueueResumeResponseDto {
  @ApiProperty({ example: 'running', enum: ['running'] })
  status!: 'running';
}
