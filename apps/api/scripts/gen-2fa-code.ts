// Dev-only helper: this sandboxed environment's system clock is set to a fixed date that does
// not match real-world time, so a real phone authenticator app (using actual wall-clock time)
// can never produce a TOTP code matching what this server computes — nothing to do with a wrong
// secret or a typo, just two clocks that disagree. Prints the code valid *right now* on this
// machine's clock, for local login/testing only.
//
// Run: pnpm --filter @czd/api exec ts-node -T scripts/gen-2fa-code.ts --email you@example.com
import { authenticator } from 'otplib';
import { SecretCipher } from '../src/common/crypto/secret-cipher';
import { PrismaClient } from '../src/generated/prisma';

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = readArg('--email');
  if (!email) {
    console.error('Usage: gen-2fa-code --email <email>');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.$disconnect();

  if (!user?.twoFactorSecret) {
    console.error(`No 2FA secret on file for ${email} — has 2FA setup been completed for this account?`);
    process.exitCode = 1;
    return;
  }

  const cipher = SecretCipher.fromBase64Key(process.env.APP_ENCRYPTION_KEY!);
  const secret = cipher.decrypt(user.twoFactorSecret);
  const code = authenticator.generate(secret);

  console.log(`Current valid code: ${code}  (server time: ${new Date().toISOString()}, valid ~30s)`);
}

main();
