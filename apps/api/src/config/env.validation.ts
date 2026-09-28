import { z } from 'zod';

// Fail fast on boot if required env vars are missing/malformed, rather than
// surfacing a confusing error later on first DB query or CORS check.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGINS: z.string().default(''),
  // Number of reverse-proxy hops in front of the API whose X-Forwarded-For entry is trusted for
  // req.ip (Express "trust proxy"). 0 = direct connections (local dev). Render = 1. Without it,
  // every request behind a proxy shares the proxy's IP, so IP-keyed rate limits (RateLimitGuard)
  // lump all users together. Never trust more hops than really exist — the extra entries are
  // client-supplied and would let anyone spoof their IP past those limits.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

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
  // Brevo Transactional Email API for the Admin site's staff emails (admin/moderator/freelancer
  // recipients). Server-side only — never NEXT_PUBLIC_*. Needs a Brevo REST key ("xkeysib-",
  // Brevo → SMTP & API → API keys); an "xsmtpsib-" SMTP key is rejected by the REST API. Active
  // only when both the key and sender email are set; otherwise admin emails use the default transport.
  BREVO_ADMIN_API_KEY: z.string().optional(),
  BREVO_ADMIN_SENDER_EMAIL: z.string().optional(),
  BREVO_ADMIN_SENDER_NAME: z.string().default('CZ Digitizing'),
  // Brevo SMTP relay for the customer site's emails. Server-side only — never NEXT_PUBLIC_*.
  // The key is a Brevo "xsmtpsib-" SMTP key (REST v3 rejects it), so it is used as the relay
  // password alongside BREVO_CUSTOMER_SMTP_LOGIN (Brevo → SMTP & API → "Login"). When both are
  // set they take precedence over SMTP_*; otherwise behaviour is unchanged.
  BREVO_CUSTOMER_API_KEY: z.string().optional(),
  BREVO_CUSTOMER_SMTP_LOGIN: z.string().optional(),

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
  // Payment is BANK TRANSFER ONLY: there are no payment-provider credentials to configure (the bank
  // account customers transfer to is edited by Admin in Settings, never in the environment).
  // AC-8 — display-only local-currency conversion (never used to price a payment): unset uses the
  // hardcoded fallback rate table in ExchangeRateService instead of a live provider.
  EXCHANGE_RATE_API_KEY: z.string().optional(),

  // Taebo (docs/specs/2026-08-28-15-taebo-chatbot.md, AC-7 — "regardless of which specific
  // model/library implements the matching"). Optional, same posture as every other third-party
  // credential above: unset means TaeboMatchingService falls back to its local keyword matcher
  // instead of failing. Never a substitute for the AC-3/AC-4 anti-fabrication contract — the LLM
  // is only ever shown the approved, published, taebo_visible FAQ set and must return no-match
  // rather than answer from general knowledge; that constraint lives in the prompt + response
  // validation in taebo-matching.service.ts, not here.
  OPENROUTER_API_KEY: z.string().optional(),
  // A genuinely free (":free"-suffixed) OpenRouter model — a paid model would silently start
  // costing money per request. The shared free-tier pool occasionally 429s under load; that's
  // fine here specifically because TaeboMatchingService treats any LLM failure as "fall back to
  // the local keyword matcher", never as an error — an unpaid model's unreliability is an
  // acceptable tradeoff this app is already built to absorb.
  OPENROUTER_MODEL: z.string().default('minimax/minimax-m2.7:free'),
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
