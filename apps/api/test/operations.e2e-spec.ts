import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eTestApp, E2eTestContext } from './e2e-test-app';

describe('Operations API (e2e)', () => {
  let context: E2eTestContext;

  afterEach(async () => {
    await context.app.close();
  });

  describe('POST /api/queue/pause', () => {
    beforeEach(async () => {
      context = await createE2eTestApp();
    });

    it('returns paused status', () => {
      return request(context.app.getHttpServer() as App)
        .post('/api/queue/pause')
        .expect(200)
        .expect({ status: 'paused' })
        .expect(() => {
          expect(context.queue.pause).toHaveBeenCalledTimes(1);
        });
    });
  });

  describe('POST /api/queue/resume', () => {
    beforeEach(async () => {
      context = await createE2eTestApp();
    });

    it('returns running status', () => {
      return request(context.app.getHttpServer() as App)
        .post('/api/queue/resume')
        .expect(200)
        .expect({ status: 'running' })
        .expect(() => {
          expect(context.queue.resume).toHaveBeenCalledTimes(1);
        });
    });
  });

  describe('GET /api/health', () => {
    it('returns ok when dependencies are healthy', async () => {
      context = await createE2eTestApp();

      await request(context.app.getHttpServer() as App)
        .get('/api/health')
        .expect(200)
        .expect({
          status: 'ok',
          workerRunning: true,
          database: 'connected',
          redis: 'connected',
          queue: {
            waiting: 0,
            active: 1,
            delayed: 0,
            completed: 42,
            failed: 3,
          },
        });
    });

    it('returns degraded when the worker heartbeat is missing', async () => {
      context = await createE2eTestApp({
        redisGet: jest.fn().mockResolvedValue(null),
      });

      await request(context.app.getHttpServer() as App)
        .get('/api/health')
        .expect(200)
        .expect({
          status: 'degraded',
          workerRunning: false,
          database: 'connected',
          redis: 'connected',
          queue: {
            waiting: 0,
            active: 1,
            delayed: 0,
            completed: 42,
            failed: 3,
          },
        });
    });

    it('returns 503 when redis is unavailable', async () => {
      context = await createE2eTestApp({
        redisPing: jest.fn().mockRejectedValue(new Error('redis down')),
      });

      await request(context.app.getHttpServer() as App)
        .get('/api/health')
        .expect(503)
        .expect({
          status: 'down',
          workerRunning: false,
          database: 'connected',
          redis: 'disconnected',
          queue: {
            waiting: 0,
            active: 1,
            delayed: 0,
            completed: 42,
            failed: 3,
          },
        });
    });
  });

  describe('GET /api/metrics', () => {
    beforeEach(async () => {
      context = await createE2eTestApp({
        queueCounts: {
          waiting: 8,
          active: 2,
          delayed: 0,
          completed: 110,
          failed: 10,
        },
      });
    });

    it('returns historical and live metrics', () => {
      return request(context.app.getHttpServer() as App)
        .get('/api/metrics')
        .expect(200)
        .expect({
          jobsProcessed: 120,
          completedJobs: 110,
          failedJobs: 10,
          queueLength: 8,
          activeJobs: 2,
          averageProcessingTimeMs: 842,
          successRate: 91.67,
        });
    });
  });
});
