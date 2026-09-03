import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

async function bootstrap() {
  // rawBody: true — Stripe webhook signature verification (stripe.webhooks.constructEvent, AC-10)
  // needs the exact raw request bytes, not the JSON-parsed body Nest's default body parser
  // produces. This option makes Nest's underlying body-parser middleware stash the raw Buffer on
  // req.rawBody for every request while still JSON-parsing req.body as normal — cheaper than
  // excluding the webhook route from global body parsing and re-parsing it by hand.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').filter(Boolean),
    credentials: true,
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
