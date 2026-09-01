// Mock request payloads and expected response shapes for sign-up/login/validation flows,
// per docs/specs/2026-08-28-01-auth-account-security.md. Field shapes are taken directly from
// the real DTOs (apps/api/src/auth/dto/register.dto.ts, login.dto.ts).

// ---------------------------------------------------------------------------
// POST /api/auth/register (RegisterDto: email!, password!, displayName?)
// ---------------------------------------------------------------------------

export const validRegisterPayload = {
  email: 'new.customer@example.com',
  password: 'password123',
};

export const validRegisterPayloadWithDisplayName = {
  email: 'named.customer@example.com',
  password: 'password123',
  displayName: 'Jordan Customer',
};

export const registerMissingEmail = {
  password: 'password123',
};

export const registerMissingPassword = {
  email: 'no.password@example.com',
};

export const registerMalformedEmail = {
  email: 'not-an-email',
  password: 'password123',
};

export const registerPasswordTooShort = {
  email: 'short.password@example.com',
  password: 'short7', // 6 chars, RegisterDto requires @MinLength(8)
};

// bcrypt's own input limit is 72 bytes (RegisterDto @MaxLength(72)) — 73 'a's.
export const registerPasswordTooLong = {
  email: 'long.password@example.com',
  password: 'a'.repeat(73),
};

export const registerUnexpectedField = {
  email: 'extra.field@example.com',
  password: 'password123',
  isAdmin: true, // not on RegisterDto — should be rejected by forbidNonWhitelisted
};

export const registerDuplicateEmail = {
  email: 'dup@example.com', // reuse: register twice with this payload to trigger 409
  password: 'password123',
};

// ---------------------------------------------------------------------------
// POST /api/auth/login (LoginDto: email!, password!)
// ---------------------------------------------------------------------------

export const loginCorrectCredentials = {
  email: 'device@example.com',
  password: 'password123',
};

export const loginWrongPassword = {
  email: 'device@example.com', // an email that WAS registered
  password: 'totally-wrong-password',
};

export const loginNonexistentEmail = {
  email: 'never.registered@example.com',
  password: 'whatever-password',
};

export const loginMalformedEmail = {
  email: 'not-an-email',
  password: 'password123',
};

export const loginMissingPassword = {
  email: 'device@example.com',
};

// ---------------------------------------------------------------------------
// Expected response envelopes (packages/shared-types/src/api.ts — ApiResponse<T> / ApiError)
// ---------------------------------------------------------------------------

// 201 — POST /api/auth/register happy path. Shape from dto/user-profile.dto.ts's
// toUserProfileDto(); id is a stringified bigint, passwordHash/twoFactorSecret never appear.
export const expectedRegisterSuccessData = {
  email: expect.any(String),
  displayName: expect.anything(), // string or null
  role: 'customer',
  gmailVerified: false,
  twoFactorEnabled: false,
};

// 409 — duplicate email (AuthService.register)
export const expectedEmailAlreadyRegisteredError = {
  code: 'EMAIL_ALREADY_REGISTERED',
  message: expect.any(String),
  traceId: expect.any(String),
};

// 401 — AuthService.login: wrong password AND non-existent email throw the exact same
// ApiException('UNAUTHENTICATED', 401, 'Invalid email or password') — assert both cases produce
// byte-identical error bodies (aside from traceId) to confirm no email-enumeration leak.
export const expectedInvalidCredentialsError = {
  code: 'UNAUTHENTICATED',
  message: 'Invalid email or password',
  traceId: expect.any(String),
};

// 400 — class-validator failure, shaped by apps/api/src/common/filters/all-exceptions.filter.ts's
// resolve(): BadRequestException with message: string[] gets mapped to VALIDATION_ERROR with one
// `errors[]` entry per failed constraint.
export const expectedValidationErrorShape = {
  code: 'VALIDATION_ERROR',
  message: 'Validation failed',
  errors: expect.arrayContaining([expect.objectContaining({ field: expect.any(String), message: expect.any(String) })]),
  traceId: expect.any(String),
};
