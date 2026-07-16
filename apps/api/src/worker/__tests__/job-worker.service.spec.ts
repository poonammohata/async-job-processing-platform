import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Worker } from 'bullmq';
import { JOB_WORKER_CONNECTION_TOKEN } from '../../queue/queue.constants';
import { JobProcessorService } from '../job-processor.service';
import { JobWorkerService } from '../job-worker.service';

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('JobWorkerService', () => {
  let service: JobWorkerService;
  let processor: { process: jest.Mock };
  let workerInstance: { on: jest.Mock; close: jest.Mock };
  const connection = { quit: jest.fn() };

  beforeEach(async () => {
    processor = { process: jest.fn() };
    workerInstance = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (Worker as jest.Mock).mockImplementation(() => workerInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobWorkerService,
        {
          provide: JobProcessorService,
          useValue: processor,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'queue') {
                return {
                  name: 'jobs',
                  workerConcurrency: 2,
                };
              }

              return undefined;
            }),
          },
        },
        {
          provide: JOB_WORKER_CONNECTION_TOKEN,
          useValue: connection,
        },
      ],
    }).compile();

    service = module.get(JobWorkerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a Worker with queue name, connection, and concurrency', () => {
    service.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      'jobs',
      expect.any(Function),
      {
        connection,
        concurrency: 2,
      },
    );
  });

  it('delegates the processor callback to JobProcessorService', async () => {
    service.onModuleInit();

    const processorCallback = (Worker as jest.Mock).mock.calls[0][1];
    const job = { id: 'job-1' };

    await processorCallback(job);

    expect(processor.process).toHaveBeenCalledWith(job);
  });

  it('registers event handlers without mutating the database', () => {
    service.onModuleInit();

    expect(workerInstance.on).toHaveBeenCalledWith(
      'completed',
      expect.any(Function),
    );
    expect(workerInstance.on).toHaveBeenCalledWith(
      'failed',
      expect.any(Function),
    );
    expect(workerInstance.on).toHaveBeenCalledWith(
      'stalled',
      expect.any(Function),
    );
    expect(workerInstance.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('closes the worker idempotently', async () => {
    service.onModuleInit();

    await service.close();
    await service.close();

    expect(workerInstance.close).toHaveBeenCalledTimes(1);
  });

  it('retries close when the first close rejects', async () => {
    service.onModuleInit();
    workerInstance.close
      .mockRejectedValueOnce(new Error('close failed'))
      .mockResolvedValueOnce(undefined);

    await expect(service.close()).rejects.toThrow('close failed');
    await expect(service.close()).resolves.toBeUndefined();
    expect(workerInstance.close).toHaveBeenCalledTimes(2);
  });
});
