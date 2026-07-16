import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupSwagger, SWAGGER_PATH } from './swagger.setup';

jest.mock('@nestjs/swagger', () => {
  const builder = {
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addTag: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ openapi: '3.0.0' }),
  };

  return {
    DocumentBuilder: jest.fn(() => builder),
    SwaggerModule: {
      createDocument: jest.fn().mockReturnValue({ paths: {} }),
      setup: jest.fn(),
    },
  };
});

describe('setupSwagger', () => {
  it('registers Swagger at /api/docs when the global prefix is api', () => {
    const app = {} as INestApplication;

    setupSwagger(app);

    expect(DocumentBuilder).toHaveBeenCalled();
    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(app, {
      openapi: '3.0.0',
    });
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      SWAGGER_PATH,
      app,
      { paths: {} },
      { useGlobalPrefix: true },
    );
  });
});
