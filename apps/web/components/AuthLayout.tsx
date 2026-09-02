import { BrandMark } from '@/components/BrandMark';
import { brand } from '@/lib/brand';

// Shared split-panel shell for the auth screens (login, forgot-password, ...), matching the
// approved mockup. Renders inside the root layout's <main>, so the global header/footer stay —
// there is no per-route layout override for auth yet.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div
        className="relative hidden w-[300px] shrink-0 flex-col justify-between overflow-hidden p-10 md:flex"
        style={{ background: brand.panelBg }}
      >
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-10"
          style={{ background: brand.accent }}
        />
        <div
          className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full opacity-[0.08]"
          style={{ background: brand.accent }}
        />

        <div className="z-10">
          <BrandMark />
        </div>

        <div className="z-10">
          <div className="font-serif text-[26px] font-semibold leading-tight text-slate-900">{brand.tagline}</div>
          <p className="mt-4 text-[14px] leading-relaxed text-slate-600">{brand.description}</p>
        </div>

        <div className="z-10 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} {brand.name}. All rights reserved.
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-8 py-12 sm:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
