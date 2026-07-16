import {
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { JobPriority, JobType, Prisma } from '@prisma/client';
import { InvalidJobScheduleError } from './errors/invalid-job-schedule.error';
import { CreateJobDto } from './dto/create-job.dto';
import { CreateJobResponseDto } from './dto/create-job-response.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit a job for asynchronous processing' })
  @ApiBody({
    type: CreateJobDto,
    examples: {
      immediate: {
        summary: 'Immediate email job',
        value: {
          type: JobType.EMAIL,
          priority: JobPriority.NORMAL,
          payload: {
            to: 'john@example.com',
            subject: 'Welcome',
            body: 'Hello',
          },
        },
      },
      delayed: {
        summary: 'Delayed notification job',
        value: {
          type: JobType.NOTIFICATION,
          priority: JobPriority.HIGH,
          delay: 30000,
          payload: {
            userId: 'user-123',
            message: 'Reminder',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 202, type: CreateJobResponseDto })
  @ApiResponse({ status: 400, description: 'Validation or schedule error' })
  @ApiResponse({ status: 503, description: 'Queue unavailable' })
  @ApiResponse({ status: 500, description: 'Unexpected server error' })
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
  @ApiOperation({ summary: 'List jobs with pagination and filters' })
  @ApiResponse({ status: 200, type: PaginatedJobsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  listJobs(@Query() query: ListJobsDto): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listJobs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full job details including attempts' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid job ID' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.getJob(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a queued job before processing starts' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Job cancelled' })
  @ApiResponse({ status: 400, description: 'Invalid job ID' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({
    status: 409,
    description: 'Job cannot be cancelled or worker race lost',
  })
  cancelJob(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.jobsService.cancelJob(id);
  }

  private toPublicScheduleMessage(message: string): string {
    return message.replace('delayMs', 'delay');
  }
}
