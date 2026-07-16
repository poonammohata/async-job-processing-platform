import { NestFactory } from '@nestjs/core';
import {
  bootstrap,
  handleBootstrapFailure,
} from '../worker.bootstrap';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn(),
  },
}));

describe('worker bootstrap', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    process.exitCode = undefined;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('sets process.exitCode to 1 when bootstrap fails', async () => {
    (NestFactory.createApplicationContext as jest.Mock).mockRejectedValue(
      new Error('startup failed'),
    );

    await bootstrap().catch(handleBootstrapFailure);

    expect(process.exitCode).toBe(1);
  });
});
