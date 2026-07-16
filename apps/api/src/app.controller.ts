import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getLiveness(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'async-job-processing-api',
    };
  }
}
