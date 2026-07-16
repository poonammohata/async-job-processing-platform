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
});
