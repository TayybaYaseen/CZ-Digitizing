import Image from 'next/image';
import { portfolioProfileContent } from '@/lib/portfolio-profile-content';

// docs/portfolio-spec.md §5.1 — mirrors Hero.tsx's structural pattern (eyebrow, hairline, Playfair
// headline, bounded photo panel with navy gradient) rather than inventing a new hero language.
export function PortfolioIdentityHero() {
  const { identity } = portfolioProfileContent;

  return (
    <section className="relative overflow-hidden rounded-card bg-brand-navy px-6 py-14 text-white sm:px-10 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.26em] text-brand-gold">Portfolio</p>
          <div className="mx-auto mt-3 h-px w-12 bg-brand-gold lg:mx-0" />
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">{identity.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-brand-gold sm:text-base lg:mx-0">{identity.descriptor}</p>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="relative overflow-hidden rounded-card border border-white/10 shadow-cz-navy">
            <Image
              src="/images/hero-embroidery-machine.png"
              alt="Machine embroidery in progress"
              width={354}
              height={110}
              sizes="(min-width: 1024px) 420px, 90vw"
              className="h-auto w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-brand-navy/10 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
