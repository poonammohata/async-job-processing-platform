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
  @IsEnum(JobType)
  type!: JobType;

  @IsEnum(JobPriority)
  priority!: JobPriority;

  @IsPlainObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delay?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  runAt?: string;
}
