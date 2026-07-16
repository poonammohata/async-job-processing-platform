import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { InvalidJobScheduleError } from '../src/jobs/errors/invalid-job-schedule.error';
import { JobsService } from '../src/jobs/jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JOB_QUEUE_TOKEN } from '../src/queue/queue.constants';
import { RedisConnectionService } from '../src/queue/redis-connection.service';
import { WorkerRedisConnectionService } from '../src/queue/worker-redis-connection.service';

export interface E2eTestContext {
  app: INestApplication;
  jobsService: { createJob: jest.Mock };
}

export async function createE2eTestApp(): Promise<E2eTestContext> {
  const jobsService = {
    createJob: jest.fn(),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JobsService)
    .useValue(jobsService)
    .overrideProvider(PrismaService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(RedisConnectionService)
    .useValue({
      getConnection: () => ({
        quit: jest.fn().mockResolvedValue('OK'),
      }),
      createConnection: () => ({
        quit: jest.fn().mockResolvedValue('OK'),
      }),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(WorkerRedisConnectionService)
    .useValue({
      getConnection: () => ({
        quit: jest.fn().mockResolvedValue('OK'),
      }),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(JOB_QUEUE_TOKEN)
    .useValue({
      close: jest.fn().mockResolvedValue(undefined),
      add: jest.fn(),
    })
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
  await app.init();

  return { app, jobsService };
}

export { InvalidJobScheduleError };
