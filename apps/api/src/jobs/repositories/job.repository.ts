import { Injectable } from '@nestjs/common';
import { Job, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindManyJobsOptions {
  page: number;
  limit: number;
  status?: JobStatus;
  orderBy?: Prisma.SortOrder;
}

export interface FindManyJobsResult {
  jobs: Job[];
  total: number;
}

@Injectable()
export class JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.JobCreateInput): Promise<Job> {
    return this.prisma.job.create({ data });
  }

  findById(id: string): Promise<Job | null> {
    return this.prisma.job.findUnique({ where: { id } });
  }

  async findMany(options: FindManyJobsOptions): Promise<FindManyJobsResult> {
    const skip = (options.page - 1) * options.limit;
    const where: Prisma.JobWhereInput = options.status
      ? { status: options.status }
      : {};
    const orderBy: Prisma.JobOrderByWithRelationInput = {
      createdAt: options.orderBy ?? 'desc',
    };

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        skip,
        take: options.limit,
        orderBy,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { jobs, total };
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.job.count({ where: { id } });
    return count > 0;
  }
}
