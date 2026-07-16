import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { InvalidJobScheduleError } from '../src/jobs/errors/invalid-job-schedule.error';
import { JobRepository } from '../src/jobs/repositories/job.repository';
import { JobsService } from '../src/jobs/jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JOB_QUEUE_TOKEN } from '../src/queue/queue.constants';
import { RedisConnectionService } from '../src/queue/redis-connection.service';
import { setupSwagger } from '../src/swagger/swagger.setup';
import { WorkerRedisConnectionService } from '../src/queue/worker-redis-connection.service';

export interface E2eTestAppOptions {
  redisPing?: jest.Mock;
  redisGet?: jest.Mock;
  queryRaw?: jest.Mock;
  queueCounts?: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  jobMetrics?: {
    countCompletedJobs: number;
    countFailedJobs: number;
    averageProcessingTimeMs: number | null;
  };
}

export interface E2eTestContext {
  app: INestApplication;
  jobsService: {
    createJob: jest.Mock;
    getJob: jest.Mock;
    listJobs: jest.Mock;
    cancelJob: jest.Mock;
    listDeadLetterJobs: jest.Mock;
  };
  queue: {
    pause: jest.Mock;
    resume: jest.Mock;
    getJobCounts: jest.Mock;
  };
  redis: {
    ping: jest.Mock;
    get: jest.Mock;
  };
  prisma: {
    $queryRaw: jest.Mock;
  };
  jobRepository: {
    countCompletedJobs: jest.Mock;
    countFailedJobs: jest.Mock;
    averageProcessingTimeMs: jest.Mock;
  };
}

const defaultQueueCounts = {
  waiting: 0,
  active: 1,
  delayed: 0,
  completed: 42,
  failed: 3,
};

const defaultJobMetrics = {
  countCompletedJobs: 110,
  countFailedJobs: 10,
  averageProcessingTimeMs: 842,
};

export async function createE2eTestApp(
  options: E2eTestAppOptions = {},
): Promise<E2eTestContext> {
  const jobsService = {
    createJob: jest.fn(),
    getJob: jest.fn(),
    listJobs: jest.fn(),
    cancelJob: jest.fn(),
    listDeadLetterJobs: jest.fn(),
  };

  const redis = {
    quit: jest.fn().mockResolvedValue('OK'),
    ping: options.redisPing ?? jest.fn().mockResolvedValue('PONG'),
    get:
      options.redisGet ??
      jest.fn().mockResolvedValue(Date.now().toString()),
  };

  const prisma = {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw:
      options.queryRaw ??
      jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const queueCounts = options.queueCounts ?? defaultQueueCounts;
  const queue = {
    close: jest.fn().mockResolvedValue(undefined),
    add: jest.fn(),
    getJob: jest.fn(),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    isPaused: jest.fn().mockResolvedValue(false),
    getJobCounts: jest.fn().mockResolvedValue(queueCounts),
  };

  const jobMetrics = options.jobMetrics ?? defaultJobMetrics;
  const jobRepository = {
    countCompletedJobs: jest
      .fn()
      .mockResolvedValue(jobMetrics.countCompletedJobs),
    countFailedJobs: jest.fn().mockResolvedValue(jobMetrics.countFailedJobs),
    averageProcessingTimeMs: jest
      .fn()
      .mockResolvedValue(jobMetrics.averageProcessingTimeMs),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JobsService)
    .useValue(jobsService)
    .overrideProvider(JobRepository)
    .useValue(jobRepository)
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RedisConnectionService)
    .useValue({
      getConnection: () => redis,
      createConnection: () => redis,
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(WorkerRedisConnectionService)
    .useValue({
      getConnection: () => redis,
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(JOB_QUEUE_TOKEN)
    .useValue(queue)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  setupSwagger(app);
  await app.init();

  return {
    app,
    jobsService,
    queue,
    redis,
    prisma,
    jobRepository,
  };
}

export { InvalidJobScheduleError };
