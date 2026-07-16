import { JobSummaryResponseDto } from './job-summary-response.dto';

export class PaginatedJobsResponseDto {
  items!: JobSummaryResponseDto[];
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}
