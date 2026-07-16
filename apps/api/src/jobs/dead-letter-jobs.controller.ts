import { Controller, Get, Query } from '@nestjs/common';
import { ListDeadLetterJobsDto } from './dto/list-dead-letter-jobs.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto';
import { JobsService } from './jobs.service';

@Controller('dead-letter-jobs')
export class DeadLetterJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  listDeadLetterJobs(
    @Query() query: ListDeadLetterJobsDto,
  ): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listDeadLetterJobs(query);
  }
}
