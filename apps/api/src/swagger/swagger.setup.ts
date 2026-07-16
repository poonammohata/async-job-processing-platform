import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Async Job Processing Platform')
    .setDescription(
      'REST API for submitting, monitoring, and managing asynchronous jobs',
    )
    .setVersion('1.0.0')
    .addTag('Jobs')
    .addTag('Dead Letter Jobs')
    .addTag('Queue')
    .addTag('Health')
    .addTag('Metrics')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: true,
  });
}
