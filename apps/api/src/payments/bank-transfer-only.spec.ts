import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// Business decision (docs/specs/2026-08-28-08-orders-payment-processing.md §11): the ONLY payment method
// is bank transfer. PayPal is removed and Stripe / card payments are not used. This guard fails if any
// provider code, SDK dependency, environment variable, UI string or route creeps back into the
// application source — so "no PayPal / Stripe flow exists" stays true rather than being true once.
//
// What is scanned: every source/config file under apps/ and packages/ (ts, tsx, js, json, prisma, and
// .env.example files). What is not: tests/specs (they legitimately assert the providers are GONE),
// prisma/migrations (history, including the migration that removes the providers), generated code,
// build output, node_modules, and docs (which record the decision).
const REPO_ROOT = resolve(__dirname, '../../../..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.expo', '.turbo', 'coverage', 'generated', 'migrations', 'test', '__tests__', 'storage', '.git']);
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.prisma', '.example']);
const PROVIDER_WORDS = /paypal|stripe/i;
const PROVIDER_ENV = /PAYPAL_|STRIPE_|PAYMENT_PROVIDER_CURRENCY|PAYMENT_RATE_MAX_AGE_HOURS/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (!/\.(spec|e2e\.spec)\.tsx?$/.test(name) && (SCAN_EXTENSIONS.has(name.slice(name.lastIndexOf('.'))) || name === '.env.example')) {
      out.push(full);
    }
  }
}

describe('bank transfer is the only payment method (no PayPal / Stripe anywhere in the application)', () => {
  const files: string[] = [];
  for (const top of ['apps', 'packages']) walk(join(REPO_ROOT, top), files);

  it('scans a meaningful set of files (guard against a wrong root)', () => {
    expect(files.length).toBeGreaterThan(200);
    expect(files.some((f) => f.endsWith(join('apps', 'api', 'prisma', 'schema.prisma')))).toBe(true);
    expect(files.some((f) => f.endsWith(join('apps', 'web', 'app', 'checkout', 'page.tsx')))).toBe(true);
  });

  it('no source, config, dependency or env file mentions PayPal or Stripe', () => {
    const offenders = files.filter((f) => PROVIDER_WORDS.test(readFileSync(f, 'utf8'))).map((f) => relative(REPO_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('no provider environment variable is referenced or declared', () => {
    const offenders = files.filter((f) => PROVIDER_ENV.test(readFileSync(f, 'utf8'))).map((f) => relative(REPO_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('there is no provider payment page, webhook controller or provider service on disk', () => {
    const present = files.map((f) => relative(REPO_ROOT, f).replace(/\\/g, '/')).filter((f) => /(webhooks?[.-]controller|payments\/(paypal|stripe)|checkout\/pay\/)/i.test(f));
    expect(present).toEqual([]);
  });
});
