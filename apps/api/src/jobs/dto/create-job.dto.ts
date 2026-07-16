import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority, JobType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Min,
} from 'class-validator';
import { IsPlainObject } from '../../common/validation/is-plain-object.decorator';

export class CreateJobDto {
  @ApiProperty({
    enum: JobType,
    example: JobType.EMAIL,
  })
  @IsEnum(JobType)
  type!: JobType;

  @ApiProperty({
    enum: JobPriority,
    example: JobPriority.NORMAL,
  })
  @IsEnum(JobPriority)
  priority!: JobPriority;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      to: 'john@example.com',
      subject: 'Welcome',
      body: 'Hello',
    },
  })
  @IsPlainObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Delay before processing in milliseconds',
    example: 30000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({
    description: 'ISO 8601 schedule time in the future',
    example: '2026-07-20T10:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  runAt?: string;
}
