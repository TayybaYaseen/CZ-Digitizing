// Dev-only helper for creating a ready-to-use customer test account — replaces hand-rolled
// register -> read-code-from-console-log -> verify-email-code curl/node scripts (see A-023a's own
// verification pass in docs/specs/SPEC_INDEX.md's 2026-09-11 note) with one reusable command.
// Writes directly to Postgres via Prisma, same as seed-admin.ts, rather than calling the real
// POST /api/auth/register route — this account is created already gmail-verified, skipping the
// email-code step entirely (register.dto.ts/password.service.ts's own rules are still matched:
// bcrypt at 12 rounds, an 8-character password minimum).
//
// Run:
//   pnpm --filter @czd/api run seed:customer -- --email customer@czd.test --password 'Str0ngP@ssw0rd!'
// or via env vars:
//   SEED_CUSTOMER_EMAIL=customer@czd.test SEED_CUSTOMER_PASSWORD='Str0ngP@ssw0rd!' pnpm --filter @czd/api run seed:customer
//
// Optional: --displayName "Some Name". Pass --force to reset the password (and re-verify the
// email) on an *existing* customer account instead of refusing — refuses on a non-customer role
// account regardless of --force, since this script has no business touching an admin/freelancer
// account.
//
// Note: this only creates the account — the mandatory new-device email-code check (AC-2/AC-3,
// docs/specs/2026-08-28-01-auth-account-security.md) still fires on that account's *first* login
// from any given device, exactly as it would for a real customer. The dev EmailService logs the
// code to this server's own console rather than sending a real email — read it from there.
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';

const BCRYPT_ROUNDS = 12; // matches src/auth/services/password.service.ts (AC-1)
const MIN_PASSWORD_LENGTH = 8; // matches src/auth/dto/register.dto.ts

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = readArg('--email') ?? process.env.SEED_CUSTOMER_EMAIL;
  const password = readArg('--password') ?? process.env.SEED_CUSTOMER_PASSWORD;
  const displayName = readArg('--displayName') ?? process.env.SEED_CUSTOMER_DISPLAY_NAME;
  const force = process.argv.includes('--force');

  if (!email || !password) {
    console.error('Usage: seed-customer --email <email> --password <password> [--displayName <name>] [--force]');
    console.error('(or set SEED_CUSTOMER_EMAIL / SEED_CUSTOMER_PASSWORD / SEED_CUSTOMER_DISPLAY_NAME)');
    process.exitCode = 1;
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Invalid email: ${email}`);
    process.exitCode = 1;
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role !== 'customer') {
        console.error(`A user with email ${email} already exists with role=${existing.role}. Refusing to touch a non-customer account.`);
        process.exitCode = 1;
        return;
      }
      if (!force) {
        console.error(`A customer account with email ${email} already exists (id=${existing.id}). Pass --force to reset its password instead.`);
        process.exitCode = 1;
        return;
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, gmailVerified: true, status: 'active', ...(displayName ? { displayName } : {}) },
      });
      console.log(`Reset password for existing customer account: ${updated.email} (id=${updated.id}).`);
    } else {
      const customer = await prisma.user.create({
        data: { email, passwordHash, displayName, role: 'customer', gmailVerified: true, status: 'active' },
      });
      console.log(`Created customer account: ${customer.email} (id=${customer.id}).`);
    }

    console.log('Note: the mandatory new-device email-code check still fires on this account\'s first login from');
    console.log('any given device — read the code from this dev server\'s own console (EmailService logs there,');
    console.log('no real email is sent) and complete verify-new-device the same way a real customer would.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
