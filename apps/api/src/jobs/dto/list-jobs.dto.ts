import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority, JobStatus, JobType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const JOB_LIST_SORT_FIELDS = ['createdAt'] as const;

export class ListJobsDto {
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

  @ApiPropertyOptional({ enum: JobStatus, example: JobStatus.QUEUED })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({ enum: JobType, example: JobType.EMAIL })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ enum: JobPriority, example: JobPriority.NORMAL })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({ enum: JOB_LIST_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(JOB_LIST_SORT_FIELDS)
  sortBy?: (typeof JOB_LIST_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
