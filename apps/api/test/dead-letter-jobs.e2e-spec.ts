import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eTestApp, E2eTestContext } from './e2e-test-app';

describe('DeadLetterJobsController (e2e)', () => {
  let context: E2eTestContext;

  const deadLetterItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'EMAIL',
    priority: 'NORMAL',
    status: 'FAILED',
    retryCount: 3,
    maxAttempts: 3,
    createdAt: '2026-07-16T10:00:00.000Z',
    startedAt: '2026-07-16T10:00:01.000Z',
    completedAt: null,
    failedAt: '2026-07-16T10:00:10.000Z',
    cancelledAt: null,
    lastError: 'Simulated permanent failure',
    processingTimeMs: 1000,
    updatedAt: '2026-07-16T10:00:10.000Z',
  };

  beforeEach(async () => {
    context = await createE2eTestApp();
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('GET /api/dead-letter-jobs returns 200 with paginated summary items', async () => {
    context.jobsService.listDeadLetterJobs.mockResolvedValue({
      items: [deadLetterItem],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .expect(200)
      .expect({
        items: [deadLetterItem],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });

    expect(context.jobsService.listDeadLetterJobs).toHaveBeenCalledWith({});
  });

  it('returns 200 with empty items when no dead-letter jobs exist', async () => {
    context.jobsService.listDeadLetterJobs.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .expect(200)
      .expect({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
  });

  it('forwards pagination and filter query parameters', async () => {
    context.jobsService.listDeadLetterJobs.mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    });

    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .query({
        page: 2,
        pageSize: 10,
        type: 'SMS',
        priority: 'HIGH',
        sortBy: 'createdAt',
        order: 'asc',
      })
      .expect(200);

    expect(context.jobsService.listDeadLetterJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        type: 'SMS',
        priority: 'HIGH',
        sortBy: 'createdAt',
        order: 'asc',
      }),
    );
  });

  it('returns 400 for invalid page', async () => {
    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .query({ page: 0 })
      .expect(400);

    expect(context.jobsService.listDeadLetterJobs).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid sortBy', async () => {
    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .query({ sortBy: 'updatedAt' })
      .expect(400);

    expect(context.jobsService.listDeadLetterJobs).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid order', async () => {
    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .query({ order: 'sideways' })
      .expect(400);

    expect(context.jobsService.listDeadLetterJobs).not.toHaveBeenCalled();
  });

  it('returns 400 for unknown query properties', async () => {
    await request(context.app.getHttpServer() as App)
      .get('/api/dead-letter-jobs')
      .query({ status: 'FAILED' })
      .expect(400);

    expect(context.jobsService.listDeadLetterJobs).not.toHaveBeenCalled();
  });
});
