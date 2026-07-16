import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getLiveness', () => {
    it('returns the temporary liveness response', () => {
      expect(appController.getLiveness()).toEqual({
        status: 'ok',
        service: 'async-job-processing-api',
      });
    });
  });
});
