'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Logo } from './Logo';

interface PublicSettings {
  whatsappNumber: string | null;
  contactEmail: string | null;
  social: { facebook?: string; instagram?: string; linkedIn?: string; xTwitter?: string; youTube?: string };
}

const SOCIAL_ICONS: { key: keyof PublicSettings['social']; label: string; glyph: string }[] = [
  { key: 'facebook', label: 'Facebook', glyph: 'f' },
  { key: 'instagram', label: 'Instagram', glyph: 'IG' },
  { key: 'linkedIn', label: 'LinkedIn', glyph: 'in' },
  { key: 'xTwitter', label: 'X / Twitter', glyph: 'X' },
  { key: 'youTube', label: 'YouTube', glyph: '▶' },
];

// SRS §18 — Footer & Social Buttons (aspect A-009). No dedicated spec file, built directly from
// the SRS like A-003 (Header). Icons hide per-platform when their URL is unset (AC already proven
// at A-005a). Appears globally via apps/web/app/layout.tsx.
export function Footer() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    apiFetch<PublicSettings>('/api/settings/public').then(setSettings).catch(() => setSettings(null));
  }, []);

  const whatsappHref = settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}` : null;

  return (
    <footer className="bg-brand-navy px-6 py-10 text-brand-silver">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo variant="dark" />
          <p className="text-xs text-brand-silver/70">Machine embroidery designs, digitizing, and vector art — trusted internationally.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Shop</h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link href="/designs" className="hover:text-white">All Designs</Link></li>
            <li><Link href="/categories" className="hover:text-white">Design Categories</Link></li>
            <li><Link href="/bundles" className="hover:text-white">Design Bundles</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Services</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {/* TODO(A-014): Services Module still Blocked — links 404 until it ships, same posture as Header.tsx's Services link. */}
            <li><Link href="/services" className="hover:text-white">Embroidery Digitizing</Link></li>
            <li><Link href="/services" className="hover:text-white">Vector Art</Link></li>
            {/* TODO(A-010): Contact Us page not yet built. */}
            <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Account</h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link href="/account" className="hover:text-white">My Account</Link></li>
            <li><Link href="/register" className="hover:text-white">Register</Link></li>
            <li><Link href="/login" className="hover:text-white">Log in</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4 text-xs">
          {settings?.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-white">
              {settings.contactEmail}
            </a>
          )}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-white">
              WhatsApp
            </a>
          )}
        </div>

        {settings?.social && Object.values(settings.social).some(Boolean) && (
          <div className="flex items-center gap-2">
            {SOCIAL_ICONS.filter((s) => settings.social[s.key]).map((s) => (
              <a
                key={s.key}
                href={settings.social[s.key]}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-xs font-semibold text-white hover:bg-white/10"
              >
                {s.glyph}
              </a>
            ))}
          </div>
        )}

        <p className="text-xs text-brand-silver/60">&copy; {new Date().getFullYear()} CZ Digitizing</p>
      </div>
    </footer>
  );
}
