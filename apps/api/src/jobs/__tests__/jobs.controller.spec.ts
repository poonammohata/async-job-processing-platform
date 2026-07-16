import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JobPriority, JobType } from '@prisma/client';
import { InvalidJobScheduleError } from '../errors/invalid-job-schedule.error';
import { CreateJobDto } from '../dto/create-job.dto';
import { JobsController } from '../jobs.controller';
import { JobsService } from '../jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: {
    createJob: jest.Mock;
    getJob: jest.Mock;
    listJobs: jest.Mock;
    cancelJob: jest.Mock;
  };

  const baseDto: CreateJobDto = {
    type: JobType.EMAIL,
    priority: JobPriority.NORMAL,
    payload: { to: 'test@example.com' },
  };

  beforeEach(async () => {
    jobsService = {
      createJob: jest.fn(),
      getJob: jest.fn(),
      listJobs: jest.fn(),
      cancelJob: jest.fn(),
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

  it('delegates GET /jobs/:id to JobsService.getJob', async () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    jobsService.getJob.mockResolvedValue({ id: jobId });

    await expect(controller.getJob(jobId)).resolves.toEqual({ id: jobId });
    expect(jobsService.getJob).toHaveBeenCalledWith(jobId);
  });

  it('delegates GET /jobs to JobsService.listJobs', async () => {
    jobsService.listJobs.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    await controller.listJobs({ page: 1, pageSize: 20 });

    expect(jobsService.listJobs).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it('propagates NotFoundException from getJob', async () => {
    jobsService.getJob.mockRejectedValue(
      new NotFoundException('Job not found'),
    );

    await expect(
      controller.getJob('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow(NotFoundException);
  });

  it('delegates DELETE /jobs/:id to JobsService.cancelJob', async () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    jobsService.cancelJob.mockResolvedValue(undefined);

    await expect(controller.cancelJob(jobId)).resolves.toBeUndefined();
    expect(jobsService.cancelJob).toHaveBeenCalledWith(jobId);
  });

  it('propagates NotFoundException from cancelJob', async () => {
    jobsService.cancelJob.mockRejectedValue(
      new NotFoundException('Job not found'),
    );

    await expect(
      controller.cancelJob('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates ConflictException from cancelJob', async () => {
    jobsService.cancelJob.mockRejectedValue(
      new ConflictException('Job cannot be cancelled in status: processing'),
    );

    await expect(
      controller.cancelJob('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow(ConflictException);
  });
});
