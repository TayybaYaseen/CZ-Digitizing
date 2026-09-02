import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Dev-only API reference, not a documented product surface — every route already carries its
  // real contract in docs/specs/*.md. Skipped in production so internal route shapes aren't
  // exposed publicly with no additional auth in front of them.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CZ Digitizing API')
        .setDescription('Auto-generated from route/DTO decorators — see docs/specs/*.md for the authoritative contract.')
        .setVersion('0.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('swagger', app, document);
  }

  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap();
