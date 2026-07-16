import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvalidJobScheduleError } from './errors/invalid-job-schedule.error';
import { CreateJobDto } from './dto/create-job.dto';
import { CreateJobResponseDto } from './dto/create-job-response.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createJob(@Body() dto: CreateJobDto): Promise<CreateJobResponseDto> {
    try {
      return await this.jobsService.createJob({
        type: dto.type,
        priority: dto.priority,
        payload: dto.payload as Prisma.InputJsonValue,
        delayMs: dto.delay,
        runAt: dto.runAt ? new Date(dto.runAt) : undefined,
      });
    } catch (error) {
      if (error instanceof InvalidJobScheduleError) {
        throw new BadRequestException(this.toPublicScheduleMessage(error.message));
      }

      throw error;
    }
  }

  @Get()
  listJobs(@Query() query: ListJobsDto): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listJobs(query);
  }

  @Get(':id')
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.getJob(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelJob(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.jobsService.cancelJob(id);
  }

  private toPublicScheduleMessage(message: string): string {
    return message.replace('delayMs', 'delay');
  }
}
