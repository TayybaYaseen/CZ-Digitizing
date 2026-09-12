'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { AccountMenu } from './AccountMenu';
import { LanguageSwitcher } from './LanguageSwitcher';
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
// (A-006), Design Bundles (A-008), and Services (A-014) all have real pages now.
//
// UI-only header layout correction (incident 2026-09-12-header-navigation-overflow): these 8 links
// used to render as a horizontal row beside the logo, which overflowed at laptop/desktop widths.
// They now live inside the hamburger drawer, grouped as MAIN (first 5) / REQUESTS (next 2) /
// COMPANY (Contact Us, below). No route, label, or destination changed — only where each link is
// rendered.
const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/categories', label: 'Design Categories' },
  { href: '/designs', label: 'All Designs' },
  { href: '/bundles', label: 'Design Bundles' },
  { href: '/get-a-quote', label: 'Get a Quote' },
  { href: '/custom-request', label: 'Custom Request' },
  { href: '/contact', label: 'Contact Us' },
];
const MAIN_LINKS = PRIMARY_LINKS.slice(0, 5);
const REQUEST_LINKS = PRIMARY_LINKS.slice(5, 7);
const CONTACT_LINK = { href: '/contact', label: 'Contact Us' };

// SRS §4 lists "More" as its own nav item with Subscription/My Account following on the next
// page break, without specifying what "More" itself contains — read here as a secondary-items
// dropdown holding those two, the natural place for "everything else" in an 8-item nav. Flagged
// as an interpretation, not a fact stated in the source. "Subscription" now points at /pricing
// (A-015, docs/specs/2026-08-28-09-subscriptions-credits.md §5) rather than the old TODO stub.
// SRS §16's own More Menu list (FAQ/Tips/Testimonials/Blog/About Us/Portfolio) is folded in here
// too — those pages are all real now (A-012, docs/specs/2026-08-28-10-content-knowledge-base.md).
// Its own sub-items and behavior (a nested list under a "More" trigger) are unchanged by the
// header layout correction — only the trigger now lives inside the drawer instead of the header row.
const MORE_LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/tips', label: 'Tips for Embroiderers' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About Us' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/pricing', label: 'Subscription' },
  { href: '/account', label: 'My Account' },
  { href: '/account/quotes', label: 'My Quotes' },
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
          placeholder="Search…"
          aria-label="Search"
          className="w-full min-w-0 rounded-field border border-brand-silver/20 bg-brand-navy px-1.5 py-1.5 text-xs text-brand-silver placeholder:text-brand-silver/40 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40 xs:px-2.5 xs:text-sm"
        />
      </form>
      {open && suggestions && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 w-[min(20rem,90vw)] overflow-y-auto rounded-field border border-gray-200 bg-white py-1 text-sm text-gray-800 shadow-cz-md">
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-4 w-4 flex-col items-center justify-center gap-[5px]">
      <span
        className={`block h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${open ? 'translate-y-[6.5px] rotate-45' : ''}`}
      />
      <span className={`block h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
      <span
        className={`block h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${open ? '-translate-y-[6.5px] -rotate-45' : ''}`}
      />
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DrawerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="px-1 pb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold/80">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function DrawerLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-field px-3 py-2.5 text-sm transition-colors ${
        active ? 'bg-white/5 font-semibold text-brand-gold' : 'text-brand-silver hover:bg-white/5 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { t } = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  // Reset the More accordion each time the drawer is closed so it doesn't reopen already-expanded.
  useEffect(() => {
    if (!menuOpen) setMoreExpanded(false);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function linkLabel(link: { href: string; label: string }) {
    return link.href === '/' ? t('nav.home') : link.href === '/services' ? t('nav.services') : link.label;
  }

  return (
    <header className="relative bg-brand-navy px-3 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex min-w-0 flex-shrink-0 items-center">
          {/* Same logo asset at two sizes, toggled by breakpoint — smaller on phones so it doesn't
              eat the width budget the search field / language / login / register controls need,
              full size everywhere else. Never stretched: `layout="horizontal"` keeps its aspect
              ratio at both heights. */}
          <span className="xs:hidden">
            <Logo variant="dark" layout="horizontal" height={26} />
          </span>
          <span className="hidden xs:inline">
            <Logo variant="dark" layout="horizontal" height={32} />
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 xs:gap-1.5 sm:gap-2.5 lg:gap-3">
          <div className="w-full min-w-[34px] max-w-[90px] flex-1 xs:min-w-[56px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-[220px] lg:max-w-xs">
            <SearchBox />
          </div>

          <LanguageSwitcher />

          {user ? (
            <>
              <NotificationBell />
              <AccountMenu />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex-shrink-0 whitespace-nowrap rounded-field border border-brand-silver/20 px-1.5 py-1.5 text-[11px] text-brand-silver hover:bg-white/5 xs:px-2 xs:text-xs sm:px-3 sm:text-sm"
              >
                {t('nav.login')}
              </Link>
              <Link
                href="/register"
                className="flex-shrink-0 whitespace-nowrap rounded-field bg-brand-gold px-1.5 py-1.5 text-[11px] font-semibold text-brand-navy hover:brightness-110 xs:px-2 xs:text-xs sm:px-3 sm:text-sm"
              >
                Register
              </Link>
            </>
          )}

          {/* Primary navigation control — SRS §3's "compact hamburger/mobile menu" is now the
              header's only navigation entry point at every breakpoint, not just small screens, so
              the logo + search + language + login/register row never has to compete with an
              8-item nav for horizontal space. */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="cz-nav-drawer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-field border border-brand-silver/20 text-brand-silver transition-colors hover:border-brand-gold/60 hover:text-brand-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold/60 xs:h-8 xs:w-8 sm:h-9 sm:w-9"
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-brand-navy/70" onClick={closeMenu} aria-hidden="true" />
          <div
            id="cz-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col overflow-y-auto border-l border-brand-silver/10 bg-brand-navy shadow-cz-navy sm:max-w-sm"
          >
            <div className="flex items-center justify-between border-b border-brand-silver/10 px-4 py-4">
              <span className="font-display text-lg tracking-wide text-white">CZ Digitizing</span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-field text-brand-silver hover:bg-white/5 hover:text-brand-gold"
              >
                <HamburgerIcon open={true} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col divide-y divide-brand-gold/15">
              <DrawerGroup title="Main">
                {MAIN_LINKS.map((link) => (
                  <DrawerLink
                    key={link.href}
                    href={link.href}
                    label={linkLabel(link)}
                    active={pathname === link.href}
                    onClick={closeMenu}
                  />
                ))}
              </DrawerGroup>

              <DrawerGroup title="Requests">
                {REQUEST_LINKS.map((link) => (
                  <DrawerLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} onClick={closeMenu} />
                ))}
              </DrawerGroup>

              <DrawerGroup title="Company">
                <DrawerLink
                  href={CONTACT_LINK.href}
                  label={CONTACT_LINK.label}
                  active={pathname === CONTACT_LINK.href}
                  onClick={closeMenu}
                />
                <button
                  type="button"
                  onClick={() => setMoreExpanded((v) => !v)}
                  aria-expanded={moreExpanded}
                  className="flex items-center justify-between rounded-field px-3 py-2.5 text-sm text-brand-silver hover:bg-white/5 hover:text-white"
                >
                  More
                  <ChevronIcon open={moreExpanded} />
                </button>
                {moreExpanded && (
                  <div className="ml-3 flex flex-col gap-0.5 border-l border-brand-gold/20 py-1 pl-3">
                    {MORE_LINKS.map((link) => (
                      <DrawerLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} onClick={closeMenu} />
                    ))}
                  </div>
                )}
              </DrawerGroup>

              <DrawerGroup title="Account">
                <Link
                  href="/cart"
                  onClick={closeMenu}
                  className="flex items-center justify-between rounded-field px-3 py-2.5 text-sm text-brand-silver hover:bg-white/5 hover:text-white"
                >
                  {t('nav.cart')}
                  {itemCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-brand-navy">
                      {itemCount}
                    </span>
                  )}
                </Link>
              </DrawerGroup>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
