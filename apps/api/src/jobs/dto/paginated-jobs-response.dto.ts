import { ApiProperty } from '@nestjs/swagger';
import { JobSummaryResponseDto } from './job-summary-response.dto';

export class PaginatedJobsResponseDto {
  @ApiProperty({ type: [JobSummaryResponseDto] })
  items!: JobSummaryResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
