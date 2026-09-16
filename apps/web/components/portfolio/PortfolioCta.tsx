'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

// docs/portfolio-spec.md §5.12/§10.4/§15 — contact info is never hardcoded here. This reads the
// same existing, Admin-configured settings Footer.tsx already reads (GET /api/settings/public),
// so a WhatsApp-number change in /admin/settings/platform is reflected automatically with no
// Portfolio-specific setting anywhere.
interface PublicSettings {
  whatsappNumber: string | null;
  contactEmail: string | null;
}

export function PortfolioCta() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    apiFetch<PublicSettings>('/api/settings/public').then(setSettings).catch(() => setSettings(null));
  }, []);

  const whatsappHref = settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}` : null;

  return (
    <section className="rounded-card bg-brand-navy px-6 py-12 text-center text-white sm:px-10">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">Ready to Turn Your Artwork Into Perfect Stitches?</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-brand-silver sm:text-base">
        Get a quote for professional embroidery digitizing, or reach out with a custom request.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/get-a-quote" className="rounded-field bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-navy shadow-cz-gold transition hover:brightness-110">
          Get a Quote
        </Link>
        <Link href="/custom-request" className="rounded-field border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
          Custom Request
        </Link>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-field border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            WhatsApp
          </a>
        )}
        {settings?.contactEmail && (
          <a
            href={`mailto:${settings.contactEmail}`}
            className="rounded-field border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Email
          </a>
        )}
      </div>
    </section>
  );
}
