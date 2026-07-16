import { ConflictException, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eTestApp, E2eTestContext, InvalidJobScheduleError } from './e2e-test-app';

describe('JobsController (e2e)', () => {
  let context: E2eTestContext;

  const validBody = {
    type: 'EMAIL',
    priority: 'NORMAL',
    payload: {
      to: 'john@example.com',
      subject: 'Welcome',
      body: 'Hello',
    },
  };

  beforeEach(async () => {
    context = await createE2eTestApp();
  });

  afterEach(async () => {
    await context.app.close();
  });

  describe('POST /api/jobs success', () => {
    it('returns 202 with queued response body', async () => {
      context.jobsService.createJob.mockResolvedValue({
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'queued',
      });

      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send(validBody)
        .expect(202)
        .expect({
          jobId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'queued',
        });

      expect(context.jobsService.createJob).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/jobs validation failures', () => {
    it('returns 400 when payload is missing', async () => {
      const { payload: _payload, ...bodyWithoutPayload } = validBody;

      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send(bodyWithoutPayload)
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid type', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, type: 'INVALID' })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid priority', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, priority: 'URGENT' })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 when payload is an array', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, payload: ['item'] })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for negative delay', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, delay: -1 })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for decimal delay', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, delay: 1.5 })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid runAt', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, runAt: 'not-a-date' })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });

    it('returns 400 for unknown properties', async () => {
      await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ ...validBody, delayMs: 1000 })
        .expect(400);

      expect(context.jobsService.createJob).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/jobs service schedule errors', () => {
    it('returns 400 when JobsService throws InvalidJobScheduleError', async () => {
      context.jobsService.createJob.mockRejectedValue(
        new InvalidJobScheduleError('runAt must be in the future'),
      );

      const response = await request(context.app.getHttpServer() as App)
        .post('/api/jobs')
        .send({
          ...validBody,
          runAt: '2026-07-20T10:30:00.000Z',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: 'runAt must be in the future',
        error: 'Bad Request',
      });
    });
  });

  describe('GET /api/jobs/:id', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 200 with full job details and attempts', async () => {
      context.jobsService.getJob.mockResolvedValue({
        id: jobId,
        type: 'EMAIL',
        priority: 'NORMAL',
        status: 'COMPLETED',
        retryCount: 0,
        maxAttempts: 3,
        payload: validBody.payload,
        delayMs: null,
        runAt: null,
        createdAt: '2026-07-16T10:00:00.000Z',
        startedAt: '2026-07-16T10:00:01.000Z',
        completedAt: '2026-07-16T10:00:02.000Z',
        failedAt: null,
        cancelledAt: null,
        lastError: null,
        processingTimeMs: 1000,
        updatedAt: '2026-07-16T10:00:02.000Z',
        attempts: [
          {
            id: 'attempt-1',
            attemptNumber: 1,
            status: 'COMPLETED',
            errorMessage: null,
            startedAt: '2026-07-16T10:00:01.000Z',
            completedAt: '2026-07-16T10:00:02.000Z',
            processingTimeMs: 1000,
            createdAt: '2026-07-16T10:00:01.000Z',
            updatedAt: '2026-07-16T10:00:02.000Z',
          },
        ],
      });

      await request(context.app.getHttpServer() as App)
        .get(`/api/jobs/${jobId}`)
        .expect(200)
        .expect((response) => {
          expect(response.body.id).toBe(jobId);
          expect(response.body.payload).toEqual(validBody.payload);
          expect(response.body.attempts).toHaveLength(1);
        });
    });

    it('returns 404 when the job does not exist', async () => {
      context.jobsService.getJob.mockRejectedValue(
        new NotFoundException(`Job ${jobId} not found`),
      );

      await request(context.app.getHttpServer() as App)
        .get(`/api/jobs/${jobId}`)
        .expect(404);
    });

    it('returns 400 for an invalid UUID', async () => {
      await request(context.app.getHttpServer() as App)
        .get('/api/jobs/not-a-uuid')
        .expect(400);

      expect(context.jobsService.getJob).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/jobs', () => {
    it('returns 200 with paginated summary items', async () => {
      context.jobsService.listJobs.mockResolvedValue({
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'EMAIL',
            priority: 'NORMAL',
            status: 'QUEUED',
            retryCount: 0,
            maxAttempts: 3,
            createdAt: '2026-07-16T10:00:00.000Z',
            startedAt: null,
            completedAt: null,
            failedAt: null,
            cancelledAt: null,
            lastError: null,
            processingTimeMs: null,
            updatedAt: '2026-07-16T10:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });

      await request(context.app.getHttpServer() as App)
        .get('/api/jobs')
        .expect(200)
        .expect({
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              type: 'EMAIL',
              priority: 'NORMAL',
              status: 'QUEUED',
              retryCount: 0,
              maxAttempts: 3,
              createdAt: '2026-07-16T10:00:00.000Z',
              startedAt: null,
              completedAt: null,
              failedAt: null,
              cancelledAt: null,
              lastError: null,
              processingTimeMs: null,
              updatedAt: '2026-07-16T10:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        });
    });

    it('returns 400 for invalid query parameters', async () => {
      await request(context.app.getHttpServer() as App)
        .get('/api/jobs')
        .query({ pageSize: 101 })
        .expect(400);

      expect(context.jobsService.listJobs).not.toHaveBeenCalled();
    });

    it('returns 400 for unknown query properties', async () => {
      await request(context.app.getHttpServer() as App)
        .get('/api/jobs')
        .query({ limit: 20 })
        .expect(400);

      expect(context.jobsService.listJobs).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 204 when a queued job is cancelled', async () => {
      context.jobsService.cancelJob.mockResolvedValue(undefined);

      await request(context.app.getHttpServer() as App)
        .delete(`/api/jobs/${jobId}`)
        .expect(204);

      expect(context.jobsService.cancelJob).toHaveBeenCalledWith(jobId);
    });

    it('returns 400 for an invalid UUID', async () => {
      await request(context.app.getHttpServer() as App)
        .delete('/api/jobs/not-a-uuid')
        .expect(400);

      expect(context.jobsService.cancelJob).not.toHaveBeenCalled();
    });

    it('returns 404 when the job does not exist', async () => {
      context.jobsService.cancelJob.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await request(context.app.getHttpServer() as App)
        .delete(`/api/jobs/${jobId}`)
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Job not found',
          error: 'Not Found',
        });
    });

    it('returns 409 when the job is processing', async () => {
      context.jobsService.cancelJob.mockRejectedValue(
        new ConflictException('Job cannot be cancelled in status: processing'),
      );

      await request(context.app.getHttpServer() as App)
        .delete(`/api/jobs/${jobId}`)
        .expect(409)
        .expect({
          statusCode: 409,
          message: 'Job cannot be cancelled in status: processing',
          error: 'Conflict',
        });
    });

    it('returns 409 when cancellation loses the worker race', async () => {
      context.jobsService.cancelJob.mockRejectedValue(
        new ConflictException(
          'Job has already started processing and cannot be cancelled',
        ),
      );

      await request(context.app.getHttpServer() as App)
        .delete(`/api/jobs/${jobId}`)
        .expect(409)
        .expect({
          statusCode: 409,
          message: 'Job has already started processing and cannot be cancelled',
          error: 'Conflict',
        });
    });
  });
});
