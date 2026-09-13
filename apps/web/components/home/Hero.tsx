import Image from 'next/image';
import Link from 'next/link';

// docs/specs/2026-09-01-20-landing-page-experience.md §5.1 — headline + primary CTA -> Get a Quote
// (AC-4, guest-accessible), secondary CTA -> All Designs. Always renders (AC-8 empty-state floor).
//
// UI-only visual correction (2026-09-12 gap analysis): the hero was a flat bg-brand-navy block with
// no photographic storytelling, which read as a generic SaaS panel rather than the brand kit's
// "Photographic hero" treatment (navy gradient over embroidery photography). The only embroidery
// photo the project has — .claude/skills/cz-digitizing-design/assets/photo-embroidery-machine.png,
// copied here as public/images/hero-embroidery-machine.png — is a 354x110 crop lifted from the brand
// kit's page scan, not full hero-resolution photography, so it's framed as a bounded, moderately
// scaled panel (capped ~2x native width) with a navy gradient rather than stretched full-bleed,
// which would visibly pixelate. A true full-bleed premium hero photo needs a higher-resolution asset.
export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-lg bg-brand-navy px-6 py-14 text-white sm:px-10 sm:py-16 lg:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.26em] text-brand-gold">Machine Embroidery Design</p>
          <div className="mx-auto mt-3 h-px w-12 bg-brand-gold lg:mx-0" />
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
            Premium Machine Embroidery, <span className="text-brand-gold">Digitized to Perfection</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-brand-silver sm:text-base lg:mx-0">
            Embroidery digitizing, vector art, and ready-made designs — trusted by customers worldwide for over a decade.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            {/* TODO(A-016): Smart Get a Quote form still Blocked — this CTA 404s until that aspect ships. */}
            <Link href="/get-a-quote" className="rounded-field bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-navy shadow-cz-gold transition hover:brightness-110">
              Get a Quote
            </Link>
            <Link href="/designs" className="rounded-field border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Browse All Designs
            </Link>
          </div>
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
          <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full border border-brand-gold/40 bg-brand-navy/60 sm:-bottom-4 sm:-right-4 sm:h-20 sm:w-20" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
