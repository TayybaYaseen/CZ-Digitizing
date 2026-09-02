'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

// SRS §4 "Header & Global Navigation" main nav, in source order. Design Categories/All Designs
// (A-006) now have real pages. Services (A-014), Design Bundles (A-008), and Subscription
// (A-015) still don't — those aspects are still Blocked per docs/specs/SPEC_INDEX.md — so those
// links 404 until each aspect ships its own page.
const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' }, // TODO(A-014)
  { href: '/categories', label: 'Design Categories' },
  { href: '/designs', label: 'All Designs' },
  { href: '/bundles', label: 'Design Bundles' }, // TODO(A-008)
];

// SRS §4 lists "More" as its own nav item with Subscription/My Account following on the next
// page break, without specifying what "More" itself contains — read here as a secondary-items
// dropdown holding those two, the natural place for "everything else" in an 8-item nav. Flagged
// as an interpretation, not a fact stated in the source.
const MORE_LINKS = [
  { href: '/subscription', label: 'Subscription' }, // TODO(A-015)
  { href: '/account', label: 'My Account' },
];

export function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // AC-10's Elasticsearch swap and covering categories/services/blog/FAQ in one merged result
    // set are documented follow-ups — /search currently covers designs only (Postgres-backed).
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setMobileOpen(false);
  }

  return (
    <header className="bg-brand-navy px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex-shrink-0">
          <Logo variant="dark" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm text-brand-silver hover:bg-white/5">
              {link.label}
            </Link>
          ))}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="rounded-md px-3 py-2 text-sm text-brand-silver hover:bg-white/5"
            >
              More
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-brand-silver/20 bg-brand-navyLight py-1 shadow-lg">
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className="block px-3 py-2 text-sm text-brand-silver hover:bg-white/5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <form onSubmit={onSearchSubmit} className="w-56">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs, services…"
              aria-label="Search"
              className="w-full rounded-md border border-brand-silver/20 bg-brand-navy px-3 py-1.5 text-sm text-brand-silver placeholder:text-brand-silver/40 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
            />
          </form>

          {/* TODO(A-011): Shopping Cart & Checkout doesn't exist yet — item count is always 0
              until that aspect ships and can report a real cart size. */}
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex items-center rounded-md border border-brand-silver/20 px-3 py-1.5 text-sm text-brand-silver hover:bg-white/5"
          >
            Cart
          </Link>

          {user ? (
            <NotificationBell />
          ) : (
            <Link href="/login" className="rounded-md bg-brand-gold px-3 py-1.5 text-sm font-semibold text-brand-navy hover:brightness-110">
              Log in
            </Link>
          )}
        </div>

        {/* SRS §3 — "Navigation becomes a compact hamburger/mobile menu on small screens." */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
          className="inline-flex items-center rounded-md border border-brand-silver/20 px-3 py-1.5 text-sm text-brand-silver lg:hidden"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      {mobileOpen && (
        <div className="mt-3 space-y-3 border-t border-brand-silver/10 pt-3 lg:hidden">
          <form onSubmit={onSearchSubmit}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs, services…"
              aria-label="Search"
              className="w-full rounded-md border border-brand-silver/20 bg-brand-navy px-3 py-2 text-sm text-brand-silver placeholder:text-brand-silver/40 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
            />
          </form>

          <nav className="flex flex-col gap-1">
            {[...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-brand-silver hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/cart" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm text-brand-silver hover:bg-white/5">
              Cart
            </Link>
            {!user && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-brand-gold hover:bg-white/5"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
