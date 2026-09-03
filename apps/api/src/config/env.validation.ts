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

  // Private file management (docs/specs/2026-08-28-05-private-file-management.md, aspect A-007).
  // Local-disk storage root, kept outside any static-served directory — no cloud storage client
  // is configured yet (spec's own storage provider is Open, see plan). Defaults to a path under
  // the API package so a fresh clone works with zero extra setup in dev.
  STORAGE_PRIVATE_ROOT: z.string().default('./storage/private'),

  // Public image uploads (design preview/gallery images) — separate root from the private
  // embroidery-file storage above; these files are meant to be publicly viewable, served via
  // main.ts's static mount at /uploads.
  STORAGE_PUBLIC_ROOT: z.string().default('./storage/public'),

  // Orders & Payment Processing (docs/specs/2026-08-28-08-orders-payment-processing.md, A-013).
  // All optional: unset PayPal/Stripe credentials mean their webhook routes verify nothing and
  // reject every event (never a silent bypass — see WebhooksController), same "not configured"
  // posture as SMTP_*/TWILIO_* above. Real secrets never live in payment_method_settings.config
  // (that JSON column is non-secret display config only, per that model's own comment).
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  // sandbox vs live — defaults to sandbox so a fresh clone never accidentally hits production.
  PAYPAL_API_BASE: z.string().default('https://api-m.sandbox.paypal.com'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // AC-8 — spec §8 risk #3 (provider not finalized): unset uses the hardcoded fallback rate table
  // in ExchangeRateService instead of a live provider.
  EXCHANGE_RATE_API_KEY: z.string().optional(),
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
