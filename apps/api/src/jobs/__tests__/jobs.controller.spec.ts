import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JobPriority, JobType } from '@prisma/client';
import { InvalidJobScheduleError } from '../errors/invalid-job-schedule.error';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobsController } from '../jobs.controller';
import { JobsService } from '../jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: { createJob: jest.Mock };

  const baseDto: CreateJobDto = {
    type: JobType.EMAIL,
    priority: JobPriority.NORMAL,
    payload: { to: 'test@example.com' },
  };

  beforeEach(async () => {
    jobsService = {
      createJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    }).compile();

    controller = module.get(JobsController);
  });

  it('calls JobsService.createJob with mapped input for a valid request', async () => {
    jobsService.createJob.mockResolvedValue({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued',
    });

    await controller.createJob(baseDto);

    expect(jobsService.createJob).toHaveBeenCalledWith({
      type: JobType.EMAIL,
      priority: JobPriority.NORMAL,
      payload: baseDto.payload,
      delayMs: undefined,
      runAt: undefined,
    });
  });

  it('maps delay to delayMs', async () => {
    jobsService.createJob.mockResolvedValue({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued',
    });

    await controller.createJob({ ...baseDto, delay: 5000 });

    expect(jobsService.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ delayMs: 5000 }),
    );
  });

  it('maps runAt string to Date', async () => {
    jobsService.createJob.mockResolvedValue({
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued',
    });
    const runAt = '2026-07-20T10:30:00.000Z';

    await controller.createJob({ ...baseDto, runAt });

    expect(jobsService.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ runAt: new Date(runAt) }),
    );
  });

  it('returns the service response unchanged', async () => {
    const response = {
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'queued' as const,
    };
    jobsService.createJob.mockResolvedValue(response);

    await expect(controller.createJob(baseDto)).resolves.toEqual(response);
  });

  it('maps InvalidJobScheduleError to BadRequestException', async () => {
    jobsService.createJob.mockRejectedValue(
      new InvalidJobScheduleError('runAt must be in the future'),
    );

    await expect(controller.createJob(baseDto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.createJob(baseDto)).rejects.toMatchObject({
      response: {
        statusCode: 400,
        message: 'runAt must be in the future',
        error: 'Bad Request',
      },
    });
  });

  it('uses public delay naming in schedule conflict errors', async () => {
    jobsService.createJob.mockRejectedValue(
      new InvalidJobScheduleError(
        'delayMs and runAt cannot both be provided',
      ),
    );

    await expect(controller.createJob(baseDto)).rejects.toMatchObject({
      response: {
        message: 'delay and runAt cannot both be provided',
      },
    });
  });

  it('does not convert unexpected service errors into BadRequestException', async () => {
    const queueError = new Error('Redis connection refused');
    jobsService.createJob.mockRejectedValue(queueError);

    await expect(controller.createJob(baseDto)).rejects.toThrow(queueError);
    await expect(controller.createJob(baseDto)).rejects.not.toThrow(
      BadRequestException,
    );
  });
});
