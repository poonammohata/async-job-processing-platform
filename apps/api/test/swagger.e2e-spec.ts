import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eTestApp, E2eTestContext } from './e2e-test-app';

describe('Swagger (e2e)', () => {
  let context: E2eTestContext;

  beforeEach(async () => {
    context = await createE2eTestApp();
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('GET /api/docs returns HTML', async () => {
    const response = await request(context.app.getHttpServer() as App)
      .get('/api/docs')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/html/i);
    expect(response.text).toContain('swagger');
  });

  it('GET /api/docs-json returns OpenAPI paths for public endpoints', async () => {
    const response = await request(context.app.getHttpServer() as App)
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.openapi).toBeDefined();
    expect(response.body.paths).toEqual(
      expect.objectContaining({
        '/api/jobs': expect.any(Object),
        '/api/jobs/{id}': expect.any(Object),
        '/api/dead-letter-jobs': expect.any(Object),
        '/api/queue/pause': expect.any(Object),
        '/api/queue/resume': expect.any(Object),
        '/api/health': expect.any(Object),
        '/api/metrics': expect.any(Object),
      }),
    );
  });
});
