import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AppConfigModule, PrismaModule],
  controllers: [AppController],
})
export class AppModule {}
