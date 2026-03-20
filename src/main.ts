import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Trust proxy para obtener IP real en Railway (X-Forwarded-For)
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Configurar CORS
  app.enableCors({
    origin: configService.get('cors.origin'),
    credentials: configService.get('cors.credentials'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global para la API
  app.setGlobalPrefix('api');

  const port = configService.get('port');
  await app.listen(port);

  console.log(`🚀 Servidor corriendo en: http://localhost:${port}/api`);
  console.log(`📚 Documentación: http://localhost:${port}/api/docs`);
}

bootstrap();
