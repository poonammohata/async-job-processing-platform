import { ApiProperty } from '@nestjs/swagger';

export class CreateJobResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId!: string;

  @ApiProperty({ example: 'queued', enum: ['queued'] })
  status!: 'queued';
}
