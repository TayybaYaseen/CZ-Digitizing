// Fills gaps the main auth.spec.ts doesn't cover for sign-up/login/validation:
//   1. Login with a WRONG PASSWORD against a real, registered email.
//   2. Login with a NON-EXISTENT email — AuthService.login() throws the identical
//      ApiException for both cases; asserted here as a no-enumeration guarantee.
//   3. DTO-level VALIDATION_ERROR coverage for RegisterDto/LoginDto.
// AC-10 (OAuth) and AC-12 (magic-link) are covered separately in auth.spec.ts — those are login
// *mechanisms*, not sign-up/login/validation in the DTO sense this file is scoped to.

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { EmailService } from '../../src/email/email.service';
import {
  validRegisterPayload,
  validRegisterPayloadWithDisplayName,
  registerMissingEmail,
  registerMissingPassword,
  registerMalformedEmail,
  registerPasswordTooShort,
  registerPasswordTooLong,
  registerUnexpectedField,
  loginWrongPassword,
  loginNonexistentEmail,
  loginMalformedEmail,
  loginMissingPassword,
  expectedRegisterSuccessData,
  expectedInvalidCredentialsError,
} from '../fixtures/auth.fixtures';

describe('Auth API — sign-up, login & validation flows', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close(); // RedisService.onModuleDestroy() already quits the client — see auth.spec.ts
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await redis.client.flushdb(); // rate-limit counters — see auth.spec.ts for why this matters
    jest.spyOn(app.get(EmailService), 'send').mockResolvedValue(undefined);
  });

  const agent = () => request.agent(app.getHttpServer());

  // ---------------------------------------------------------------------
  // Sign-up (AC-1) — happy paths not covered by the main suite
  // ---------------------------------------------------------------------
  describe('POST /api/auth/register — happy paths', () => {
    it('registers with an optional displayName and returns it on the profile', async () => {
      const res = await agent().post('/api/auth/register').send(validRegisterPayloadWithDisplayName);
      expect(res.status).toBe(201);
      expect(res.body.data.displayName).toBe(validRegisterPayloadWithDisplayName.displayName);
    });

    it('registers without a displayName and returns null, not undefined or omitted', async () => {
      const res = await agent().post('/api/auth/register').send(validRegisterPayload);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject(expectedRegisterSuccessData);
      expect(res.body.data.displayName).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Sign-up — validation flows
  // ---------------------------------------------------------------------
  describe('POST /api/auth/register — validation (400 VALIDATION_ERROR)', () => {
    it.each([
      ['missing email', registerMissingEmail, 'email'],
      ['missing password', registerMissingPassword, 'password'],
      ['malformed email', registerMalformedEmail, 'email'],
      ['password shorter than 8 characters', registerPasswordTooShort, 'password'],
      ['password longer than 72 characters (bcrypt limit)', registerPasswordTooLong, 'password'],
    ])('rejects %s with a field-level error', async (_label, payload, expectedField) => {
      const res = await agent().post('/api/auth/register').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: expectedField })]),
      );
    });

    it('rejects an unexpected/unwhitelisted field with the actual field name', async () => {
      const res = await agent().post('/api/auth/register').send(registerUnexpectedField);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors[0].field).toBe('isAdmin');
      expect(res.body.error.errors[0].message).toContain('isAdmin');
    });

    it('does not create a user row when registration fails validation', async () => {
      await agent().post('/api/auth/register').send(registerMalformedEmail);
      const count = await prisma.user.count();
      expect(count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // Login — invalid-credentials flows
  // ---------------------------------------------------------------------
  describe('POST /api/auth/login — invalid credentials (401 UNAUTHENTICATED)', () => {
    it('rejects a wrong password for a registered email', async () => {
      await agent().post('/api/auth/register').send({ email: 'device@example.com', password: 'password123' });

      const res = await agent().post('/api/auth/login').send(loginWrongPassword);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject(expectedInvalidCredentialsError);
    });

    it('rejects a non-existent email with the SAME error body as a wrong password (no enumeration)', async () => {
      await agent().post('/api/auth/register').send({ email: 'device@example.com', password: 'password123' });

      const wrongPasswordRes = await agent().post('/api/auth/login').send(loginWrongPassword);
      const nonexistentRes = await agent().post('/api/auth/login').send(loginNonexistentEmail);

      expect(nonexistentRes.status).toBe(wrongPasswordRes.status);
      expect(nonexistentRes.body.error.code).toBe(wrongPasswordRes.body.error.code);
      expect(nonexistentRes.body.error.message).toBe(wrongPasswordRes.body.error.message);
      // traceId intentionally not compared — unique per request.
    });
  });

  // ---------------------------------------------------------------------
  // Login — validation flows
  // ---------------------------------------------------------------------
  describe('POST /api/auth/login — validation (400 VALIDATION_ERROR)', () => {
    it('rejects a malformed email before it ever reaches AuthService (no UNAUTHENTICATED leak)', async () => {
      const res = await agent().post('/api/auth/login').send(loginMalformedEmail);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a missing password field', async () => {
      const res = await agent().post('/api/auth/login').send(loginMissingPassword);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
      );
    });
  });
});
