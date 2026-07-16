import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority, JobType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { DEAD_LETTER_JOB_SORT_FIELDS } from '../jobs.mapper';

export class ListDeadLetterJobsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ enum: JobType, example: JobType.EMAIL })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ enum: JobPriority, example: JobPriority.HIGH })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({
    enum: DEAD_LETTER_JOB_SORT_FIELDS,
    default: 'failedAt',
  })
  @IsOptional()
  @IsIn(DEAD_LETTER_JOB_SORT_FIELDS)
  sortBy?: (typeof DEAD_LETTER_JOB_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
