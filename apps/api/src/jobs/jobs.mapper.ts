import { JobPriority, JobStatus, JobType, Prisma } from '@prisma/client';

export const JOB_LIST_SELECT = {
  id: true,
  type: true,
  priority: true,
  status: true,
  retryCount: true,
  maxAttempts: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  cancelledAt: true,
  lastError: true,
  processingTimeMs: true,
  updatedAt: true,
} satisfies Prisma.JobSelect;

export type JobSummary = Prisma.JobGetPayload<{
  select: typeof JOB_LIST_SELECT;
}>;

export const JOB_LIST_SORT_FIELDS = ['createdAt'] as const;
export type JobListSortField = (typeof JOB_LIST_SORT_FIELDS)[number];

export interface FindManyJobsOptions {
  page: number;
  pageSize: number;
  where: Prisma.JobWhereInput;
  sortBy: JobListSortField;
  order: Prisma.SortOrder;
}

export interface JobListFilters {
  status?: JobStatus;
  type?: JobType;
  priority?: JobPriority;
}

export function buildJobWhereInput(filters: JobListFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {};

  if (filters.status !== undefined) {
    where.status = filters.status;
  }

  if (filters.type !== undefined) {
    where.type = filters.type;
  }

  if (filters.priority !== undefined) {
    where.priority = filters.priority;
  }

  return where;
}

export const DEAD_LETTER_JOB_SORT_FIELDS = ['failedAt', 'createdAt'] as const;
export type DeadLetterJobSortField =
  (typeof DEAD_LETTER_JOB_SORT_FIELDS)[number];

export interface DeadLetterJobListFilters {
  type?: JobType;
  priority?: JobPriority;
}

export interface FindDeadLetterJobsOptions {
  page: number;
  pageSize: number;
  type?: JobType;
  priority?: JobPriority;
  sortBy: DeadLetterJobSortField;
  order: Prisma.SortOrder;
}

export function buildDeadLetterJobWhereInput(
  filters: DeadLetterJobListFilters,
): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {
    status: JobStatus.FAILED,
    // Conceptually dead-letter means retryCount >= maxAttempts, but Prisma
    // cannot compare two row fields in a normal where clause. Enqueue failures
    // are FAILED with retryCount = 0; the worker only marks FAILED on the final
    // attempt with retryCount > 0, so this proxy excludes submission failures.
    retryCount: { gt: 0 },
  };

  if (filters.type !== undefined) {
    where.type = filters.type;
  }

  if (filters.priority !== undefined) {
    where.priority = filters.priority;
  }

  return where;
}

export type JobWithAttempts = Prisma.JobGetPayload<{
  include: {
    attempts: true;
  };
}>;

export function toJobAttemptResponseDto(
  attempt: JobWithAttempts['attempts'][number],
) {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    errorMessage: attempt.errorMessage,
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
    processingTimeMs: attempt.processingTimeMs,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  };
}

export function toJobResponseDto(job: JobWithAttempts) {
  return {
    id: job.id,
    type: job.type,
    priority: job.priority,
    status: job.status,
    retryCount: job.retryCount,
    maxAttempts: job.maxAttempts,
    payload: job.payload,
    delayMs: job.delayMs,
    runAt: job.runAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failedAt: job.failedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    lastError: job.lastError,
    processingTimeMs: job.processingTimeMs,
    updatedAt: job.updatedAt.toISOString(),
    attempts: job.attempts.map(toJobAttemptResponseDto),
  };
}

export function toJobSummaryResponseDto(job: JobSummary) {
  return {
    id: job.id,
    type: job.type,
    priority: job.priority,
    status: job.status,
    retryCount: job.retryCount,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failedAt: job.failedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    lastError: job.lastError,
    processingTimeMs: job.processingTimeMs,
    updatedAt: job.updatedAt.toISOString(),
  };
}

export type JobAttemptResponseDto = ReturnType<typeof toJobAttemptResponseDto>;
export type JobResponseDto = ReturnType<typeof toJobResponseDto>;
export type JobSummaryResponseDto = ReturnType<typeof toJobSummaryResponseDto>;
