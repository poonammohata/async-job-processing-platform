import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListDeadLetterJobsDto } from './dto/list-dead-letter-jobs.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto';
import { JobsService } from './jobs.service';

@ApiTags('Dead Letter Jobs')
@Controller('dead-letter-jobs')
export class DeadLetterJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @ApiOperation({
    summary: 'List permanently failed jobs from the PostgreSQL dead-letter view',
  })
  @ApiResponse({ status: 200, type: PaginatedJobsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  listDeadLetterJobs(
    @Query() query: ListDeadLetterJobsDto,
  ): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listDeadLetterJobs(query);
  }
}
