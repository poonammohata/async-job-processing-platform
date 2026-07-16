import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JobsModule,
    QueueModule,
    HealthModule,
    MetricsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
