import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvalidJobScheduleError } from './errors/invalid-job-schedule.error';
import { CreateJobDto } from './dto/create-job.dto';
import { CreateJobResponseDto } from './dto/create-job-response.dto';
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

  private toPublicScheduleMessage(message: string): string {
    return message.replace('delayMs', 'delay');
  }
}
