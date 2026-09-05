'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Logo } from './Logo';

// Mirrors the NAV structure decoded from docs/CZ Digitizing Admin Panel.html's bundled
// AdminShell (SidebarNav items, 3 sections). Dashboard/Designs/Bundles/Settings/Accounts have real
// pages; Orders/Customers/Payments/Quotes/Reports are still Blocked in docs/specs/SPEC_INDEX.md
// (their owning aspects — A-013, A-019, A-005e — don't exist yet) and 404 until built, same
// posture as apps/web's Header.tsx nav.
const NAV: { section?: string; href?: string; label?: string }[] = [
  { section: 'Main' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' }, // TODO(A-013)
  { href: '/customers', label: 'Customers' }, // TODO(A-019)
  { href: '/designs', label: 'Designs' },
  { href: '/bundles', label: 'Bundles' },
  { section: 'Business' },
  { href: '/payments', label: 'Payments' }, // TODO(A-013)
  { href: '/quotes', label: 'Quotes' }, // TODO(A-016)
  { href: '/pricing', label: 'Subscription Plans' }, // A-015
  { href: '/credits', label: 'Credit Packages' }, // A-015
  { section: 'Content' }, // A-012 (docs/specs/2026-08-28-10-content-knowledge-base.md)
  { href: '/faq', label: 'FAQ' },
  { href: '/tips', label: 'Tips' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About Us' },
  { href: '/portfolio', label: 'Portfolio' },
  { section: 'System' },
  { href: '/reports', label: 'Reports' }, // TODO(A-005e)
  { href: '/settings/platform', label: 'Settings' },
  { href: '/settings/freelancer-accounts', label: 'Accounts' },
  { href: '/settings/file-formats', label: 'File Formats' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  return (
    <nav className="flex w-[216px] flex-shrink-0 flex-col bg-navy-800 text-white">
      <div className="border-b border-white/10 px-4 py-[18px]">
        <Logo variant="dark" />
      </div>

      <div className="grid flex-1 content-start gap-0.5 px-3 py-4">
        {NAV.map((item, i) =>
          item.section ? (
            <div key={`s${i}`} className={`px-2.5 ${i === 0 ? 'pb-2' : 'pb-2 pt-4'} text-[9px] font-semibold uppercase tracking-[0.26em] text-white/35`}>
              {item.section}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href!}
              className={`rounded-md px-2.5 py-2.5 text-xs font-medium transition-colors ${
                pathname.startsWith(item.href!) ? 'bg-gold-500 font-semibold text-navy-800' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ),
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 px-1 pb-2.5">
          <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-semibold text-navy-800">
            {(user.displayName ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[11px] font-semibold text-white">{user.displayName ?? user.email}</div>
            <div className="text-[9px] uppercase tracking-wide text-gold-500">{user.role}</div>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="w-full rounded-md px-2.5 py-2.5 text-left text-xs font-medium text-white/60 hover:bg-white/5"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
