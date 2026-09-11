// Dev-only helper: mints a fresh, valid email-verification code for an existing (unverified)
// account without needing to register through the real UI and scrape the code back out of the
// dev EmailService's console log — the same category of shortcut gen-2fa-code.ts already provides
// for admin TOTP codes. Unlike a 2FA secret, the verification code itself is only ever stored as a
// sha256 hash (VerificationCodeService.issueEmailCode(), src/auth/services/verification-code.service.ts)
// — there is nothing to read back once issued, so this script *issues a new one* directly against
// this server's own Redis, exactly the way a real POST /api/auth/register call does, and prints the
// plaintext. The freshly minted code immediately supersedes any code a real register call may have
// already issued (same key, overwritten) — call this right before verifying, not long before.
//
// Run:
//   pnpm --filter @czd/api run gen:email-verify-code -- --email you@example.com
//
// Then verify it for real, exactly as a customer's client would:
//   curl -X POST http://localhost:4000/api/auth/verify-email-code \
//     -H "Content-Type: application/json" -d '{"email":"you@example.com","code":"<printed code>"}'
import { createHash, randomInt } from 'crypto';
import { Redis } from 'ioredis';
import { EMAIL_CODE_TTL_MS } from '../src/auth/auth.constants';
import { PrismaClient } from '../src/generated/prisma';

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function generateCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, '0'); // matches VerificationCodeService.generateCode()
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex'); // matches VerificationCodeService.hash()
}

async function main() {
  const email = readArg('--email') ?? process.env.SEED_VERIFY_EMAIL;
  if (!email) {
    console.error('Usage: gen-email-verify-code --email <email>');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.$disconnect();

  if (!user) {
    console.error(`No account found for ${email} — register one first (or use seed:customer).`);
    process.exitCode = 1;
    return;
  }
  if (user.gmailVerified) {
    console.log(`${email} is already gmail-verified (id=${user.id}) — nothing to do.`);
    return;
  }

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const code = generateCode();
    const key = `auth:emailverify:${user.id}`; // matches VerificationCodeService.emailCodeKey()
    const record = { hash: hashCode(code), attempts: 0 };
    await redis.set(key, JSON.stringify(record), 'PX', EMAIL_CODE_TTL_MS);

    console.log(`Verification code for ${email}: ${code}  (valid ${EMAIL_CODE_TTL_MS / 60_000} min)`);
    console.log(`Verify with: POST /api/auth/verify-email-code { "email": "${email}", "code": "${code}" }`);
  } finally {
    await redis.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
