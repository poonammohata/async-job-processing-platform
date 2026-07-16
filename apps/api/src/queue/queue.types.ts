import { JobPriority, JobType, Prisma } from '@prisma/client';

export interface QueueJobData {
  jobId: string;
  type: JobType;
  payload: Prisma.JsonValue;
}

export interface EnqueueInput {
  jobId: string;
  type: JobType;
  payload: Prisma.JsonValue;
  priority: JobPriority;
  delayMs?: number;
}

export const JOB_PRIORITY_MAP: Record<JobPriority, number> = {
  [JobPriority.HIGH]: 1,
  [JobPriority.NORMAL]: 5,
  [JobPriority.LOW]: 10,
};

export function mapJobPriorityToBullMq(priority: JobPriority): number {
  return JOB_PRIORITY_MAP[priority];
}

export function toQueueJobName(type: JobType): string {
  return type.toLowerCase();
}

export interface QueueJobCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}
