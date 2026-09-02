// One-time bootstrap for the very first Admin account. There is no other way to create one —
// docs/specs/2026-08-28-01-auth-account-security.md deliberately has no public admin-registration
// route (POST /api/auth/register always creates role=customer; every other admin/freelancer
// account can only be created by an *already-authenticated* admin via
// POST /api/admin/freelancer-accounts, which is @Roles('admin')-gated). This script exists so
// that bootstrap step doesn't require direct database access.
//
// Run once, from a trusted machine/terminal with DATABASE_URL access — never expose this as an
// HTTP route or web page:
//   pnpm --filter @czd/api run seed:admin -- --email you@example.com --password 'Str0ngP@ssw0rd!'
// or via env vars:
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='Str0ngP@ssw0rd!' pnpm --filter @czd/api run seed:admin
//
// Refuses to run if the target email already exists (any role), and refuses if any admin already
// exists unless --force is passed — this is a first-admin bootstrap, not a general "create admin"
// tool; ongoing admin creation goes through the freelancer-accounts flow once you can log in.
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';

const BCRYPT_ROUNDS = 12; // matches src/auth/services/password.service.ts (AC-1)
const MIN_PASSWORD_LENGTH = 8; // matches src/auth/dto/register.dto.ts

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = readArg('--email') ?? process.env.SEED_ADMIN_EMAIL;
  const password = readArg('--password') ?? process.env.SEED_ADMIN_PASSWORD;
  const force = process.argv.includes('--force');

  if (!email || !password) {
    console.error('Usage: seed-admin --email <email> --password <password> [--force]');
    console.error('(or set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)');
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
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`A user with email ${email} already exists (role=${existing.role}). Refusing to overwrite.`);
      process.exitCode = 1;
      return;
    }

    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount > 0 && !force) {
      console.error(
        `${adminCount} admin account(s) already exist. This script is for first-admin bootstrap only — ` +
          'use an existing admin\'s "Freelancer & limited-admin accounts" page to create more, or pass --force to override.',
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const admin = await prisma.user.create({
      data: { email, passwordHash, role: 'admin', gmailVerified: true, status: 'active' },
    });

    console.log(`Created admin account: ${admin.email} (id=${admin.id}).`);
    console.log('Note: 2FA is mandatory on admin login (AC-5) — you will be prompted to set it up on first sign-in.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
