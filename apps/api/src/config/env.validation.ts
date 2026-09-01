import { z } from 'zod';

// Fail fast on boot if required env vars are missing/malformed, rather than
// surfacing a confusing error later on first DB query or CORS check.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGINS: z.string().default(''),

  // Auth (docs/specs/2026-08-28-01-auth-account-security.md)
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // AES-256-GCM key (32 bytes) for encrypting users.two_factor_secret at rest, base64-encoded.
  APP_ENCRYPTION_KEY: z.string().min(1, 'APP_ENCRYPTION_KEY is required'),

  // Email — optional. When unset, EmailService logs to the console instead of sending,
  // so local dev works with zero email infra.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('CZ Digitizing <no-reply@czdigitizing.com>'),

  // OAuth — optional per provider. A provider's routes 501 until its pair is set.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),

  // Public base URL used to build OAuth redirect/callback and magic-link URLs.
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),

  // Notifications (docs/specs/2026-08-28-02-notifications-system.md). Twilio covers WhatsApp
  // (AC-6) and SMS (AC-10) — same credential pair, distinct "from" numbers. All optional: unset
  // means the corresponding channel logs + records a "not configured" delivery-log failure
  // instead of sending, same no-op-when-unset philosophy as SMTP_* above.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  // Admin "new registration" hourly batch (architecture: "if enabled") — off by default.
  NOTIFY_REGISTRATION_BATCH_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
