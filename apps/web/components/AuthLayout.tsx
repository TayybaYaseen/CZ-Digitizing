import { Logo } from '@/components/Logo';

// Shared split-panel shell for the auth screens (login, forgot-password, ...), matching the
// approved mockup. Renders inside the root layout's <main>, so the global header/footer stay —
// there is no per-route layout override for auth yet.
//
// The panel previously rendered a pre-A-001 placeholder (`BrandMark`/`lib/brand.ts`: an indigo
// square-icon mark and a generic "Your documents, organized and searchable." tagline left over from
// before the brand kit existed) instead of the real Logo component and brand palette — replaced here
// with the "Navy flat" background treatment the brand doc specifies for this kind of panel.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl overflow-hidden rounded-2xl border border-brand-lightGray shadow-cz-navy">
      <div className="relative hidden w-[300px] shrink-0 flex-col justify-between overflow-hidden bg-brand-navy p-10 md:flex">
        <div className="z-10">
          <Logo variant="dark" height={64} />
        </div>

        <div className="z-10">
          <div className="font-display text-[26px] font-bold leading-tight text-white">Your Vision, Our Stitches</div>
          <div className="mt-3 h-px w-10 bg-brand-gold" />
          <p className="mt-4 text-[14px] leading-relaxed text-brand-silver">
            Manage your orders, purchased designs, and custom digitizing requests — all in one place.
          </p>
        </div>

        <div className="z-10 text-xs text-white/50">
          &copy; {new Date().getFullYear()} CZ Digitizing. All rights reserved.
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-8 py-12 sm:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
