import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eTestApp, E2eTestContext } from './e2e-test-app';

describe('AppController (e2e)', () => {
  let context: E2eTestContext;

  beforeEach(async () => {
    context = await createE2eTestApp();
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('/api (GET)', () => {
    return request(context.app.getHttpServer() as App)
      .get('/api')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'async-job-processing-api',
      });
  });
});
