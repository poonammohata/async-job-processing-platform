import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

const logger = new Logger('WorkerBootstrap');

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.enableShutdownHooks();

  logger.log('Worker application context started');
}

export function handleBootstrapFailure(error: unknown): void {
  logger.error(
    'Worker failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
}
