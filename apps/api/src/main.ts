import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Real client IP for req.ip behind a proxy (see TRUST_PROXY_HOPS in env.validation.ts).
  const trustProxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').filter(Boolean),
    credentials: true,
    // apps/mobile has no cookie jar — it reads the device id AuthController.resolveDevice() sets
    // back off this response header instead of the httpOnly cookie apps/web relies on. A custom
    // response header is invisible to browser JS cross-origin unless explicitly exposed here.
    exposedHeaders: ['x-device-id'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Serves ImageUploadService's public design-image uploads — deliberately separate from A-007's
  // private embroidery-file storage, which is never served like this.
  app.use('/uploads', express.static(join(config.get('STORAGE_PUBLIC_ROOT', { infer: true }))));

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
