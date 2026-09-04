'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

// Mirrors DesignsService.searchSuggestions()'s return shape (AC-6).
interface SearchSuggestions {
  designs: { id: string; name: string; previewImageUrl: string }[];
  categories: { id: string; name: string; slug: string }[];
  subcategories: { id: string; name: string; slug: string }[];
}

const SEARCH_DEBOUNCE_MS = 250;

// SRS §4 "Header & Global Navigation" main nav, in source order. Design Categories/All Designs
// (A-006) and Design Bundles (A-008) now have real pages. Services (A-014) still doesn't — that
// aspect is still Blocked per docs/specs/SPEC_INDEX.md — so that link 404s until its aspect ships
// its own page.
const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' }, // TODO(A-014)
  { href: '/categories', label: 'Design Categories' },
  { href: '/designs', label: 'All Designs' },
  { href: '/bundles', label: 'Design Bundles' },
];

// SRS §4 lists "More" as its own nav item with Subscription/My Account following on the next
// page break, without specifying what "More" itself contains — read here as a secondary-items
// dropdown holding those two, the natural place for "everything else" in an 8-item nav. Flagged
// as an interpretation, not a fact stated in the source. "Subscription" now points at /pricing
// (A-015, docs/specs/2026-08-28-09-subscriptions-credits.md §5) rather than the old TODO stub.
// SRS §16's own More Menu list (FAQ/Tips/Testimonials/Blog/About Us/Portfolio) is folded in here
// too — those pages are all real now (A-012, docs/specs/2026-08-28-10-content-knowledge-base.md).
const MORE_LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/tips', label: 'Tips for Embroiderers' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About Us' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/pricing', label: 'Subscription' },
  { href: '/account', label: 'My Account' },
];

// AC-6 — debounced live suggestions (design name/category/subcategory/tags today; services/blog/
// FAQ are documented follow-ups, TODO(A-014, A-012d) — see DesignsService.searchSuggestions())
// plus a "View All Results" action to /search?q=.
function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions(null);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<SearchSuggestions>(`/api/designs/search/suggestions?q=${encodeURIComponent(q)}`)
        .then((res) => {
          setSuggestions(res);
          setOpen(true);
        })
        .catch(() => setSuggestions(null));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function goToAllResults() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
    onNavigate?.();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToAllResults();
  }

  const hasResults = !!suggestions && (suggestions.designs.length > 0 || suggestions.categories.length > 0 || suggestions.subcategories.length > 0);

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={onSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Search designs, services…"
          aria-label="Search"
          className="w-full rounded-md border border-brand-silver/20 bg-brand-navy px-3 py-1.5 text-sm text-brand-silver placeholder:text-brand-silver/40 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
        />
      </form>
      {open && suggestions && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm text-gray-800 shadow-lg">
          {!hasResults ? (
            <p className="px-3 py-2 text-gray-400">No matches.</p>
          ) : (
            <>
              {suggestions.designs.map((d) => (
                <Link
                  key={`design-${d.id}`}
                  href={`/designs/${d.id}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="block px-3 py-2 hover:bg-gray-50"
                >
                  {d.name}
                </Link>
              ))}
              {suggestions.categories.map((c) => (
                <Link
                  key={`category-${c.id}`}
                  href={`/categories/${c.slug}`}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="block px-3 py-2 text-gray-500 hover:bg-gray-50"
                >
                  Category: {c.name}
                </Link>
              ))}
              {suggestions.subcategories.map((s) => (
                <span key={`subcategory-${s.id}`} className="block px-3 py-2 text-gray-500">
                  Subcategory: {s.name}
                </span>
              ))}
            </>
          )}
          <button onClick={goToAllResults} className="block w-full border-t border-gray-100 px-3 py-2 text-left font-medium text-brand-navy hover:bg-gray-50">
            View All Results
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
          <div className="w-56">
            <SearchBox />
          </div>

          <Link
            href="/cart"
            aria-label="Cart"
            className="relative inline-flex items-center rounded-md border border-brand-silver/20 px-3 py-1.5 text-sm text-brand-silver hover:bg-white/5"
          >
            Cart
            {itemCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-brand-navy">
                {itemCount}
              </span>
            )}
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
          <SearchBox onNavigate={() => setMobileOpen(false)} />

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
              Cart{itemCount > 0 ? ` (${itemCount})` : ''}
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
