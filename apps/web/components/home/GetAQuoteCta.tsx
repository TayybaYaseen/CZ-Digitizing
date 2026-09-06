'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

// docs/specs/2026-09-01-20-landing-page-experience.md AC-4 — guest-accessible, pre-fills the
// signed-in visitor's account email once A-016 (Smart Get a Quote) exists to read it.
// TODO(A-016): still Blocked — this link 404s for now, same posture as the Hero's own CTA.
export function GetAQuoteCta() {
  const { user } = useAuth();
  const href = user ? `/get-a-quote?email=${encodeURIComponent(user.email)}` : '/get-a-quote';

  return (
    <section className="rounded-lg bg-gradient-to-r from-brand-navy to-brand-navyLight px-6 py-12 text-center text-white">
      <h2 className="font-display text-2xl font-bold">Need a Custom Quote?</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-brand-silver">
        Get instant answers to common questions, then submit your project — no account required.
      </p>
      <Link href={href} className="mt-6 inline-block rounded-md bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-navy hover:brightness-110">
        Get a Quote
      </Link>
    </section>
  );
}
