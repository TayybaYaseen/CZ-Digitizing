// Dev-only helper: mints a fresh new-device verification code (AC-3/AC-4,
// docs/specs/2026-08-28-01-auth-account-security.md) for a customer's most recent pending
// (unverified) session, without scraping it back out of the dev EmailService's console log —
// same category of shortcut gen-2fa-code.ts and gen-email-verify-code.ts already provide for
// their own flows. Unlike the email-verify code, the device code lives on the `sessions` row
// itself (VerificationCodeService.issueDeviceCode(), src/auth/services/verification-code.service.ts),
// keyed by session id, not user id — so this script finds that account's newest
// isVerified=false/revokedAt=null session and overwrites its code the same way a real login
// attempt from that device would.
//
// Run:
//   pnpm --filter @czd/api run gen:device-code -- --email you@example.com
//
// First POST /api/auth/login from the device under test (creates the pending session), then run
// this, then verify for real exactly as a customer's client would:
//   curl -X POST http://localhost:4000/api/auth/verify-new-device \
//     -H "Content-Type: application/json" -d '{"email":"you@example.com","code":"<printed code>"}'
import { createHash, randomInt } from 'crypto';
import { DEVICE_CODE_TTL_MS } from '../src/auth/auth.constants';
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
  const email = readArg('--email') ?? process.env.SEED_DEVICE_EMAIL;
  if (!email) {
    console.error('Usage: gen-device-code --email <email>');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No account found for ${email} — register one first (or use seed:customer).`);
      process.exitCode = 1;
      return;
    }

    const pending = await prisma.session.findFirst({
      where: { userId: user.id, isVerified: false, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) {
      console.error(
        `No pending (unverified) session for ${email} — attempt a login from the device under test first, which is what creates it.`,
      );
      process.exitCode = 1;
      return;
    }

    const code = generateCode();
    await prisma.session.update({
      where: { id: pending.id },
      data: {
        verificationCodeHash: hashCode(code),
        verificationAttempts: 0,
        verificationExpiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS),
      },
    });

    console.log(`Device verification code for ${email} (session ${pending.id}): ${code}  (valid ${DEVICE_CODE_TTL_MS / 60_000} min)`);
    console.log(`Verify with: POST /api/auth/verify-new-device { "email": "${email}", "code": "${code}" }`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
