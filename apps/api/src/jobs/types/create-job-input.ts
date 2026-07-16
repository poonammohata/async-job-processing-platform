import { JobPriority, JobType, Prisma } from '@prisma/client';

export interface CreateJobInput {
  type: JobType;
  priority: JobPriority;
  payload: Prisma.InputJsonValue;
  delayMs?: number;
  runAt?: Date;
}
