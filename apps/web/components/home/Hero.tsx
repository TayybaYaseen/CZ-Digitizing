import Link from 'next/link';

// docs/specs/2026-09-01-20-landing-page-experience.md §5.1 — headline + primary CTA -> Get a Quote
// (AC-4, guest-accessible), secondary CTA -> All Designs. Always renders (AC-8 empty-state floor).
export function Hero() {
  return (
    <section className="rounded-lg bg-brand-navy px-6 py-16 text-center text-white sm:py-20">
      <h1 className="font-display text-3xl font-bold sm:text-5xl">
        Premium Machine Embroidery, <span className="text-brand-gold">Digitized to Perfection</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-sm text-brand-silver sm:text-base">
        Embroidery digitizing, vector art, and ready-made designs — trusted by customers worldwide for over a decade.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {/* TODO(A-016): Smart Get a Quote form still Blocked — this CTA 404s until that aspect ships. */}
        <Link href="/get-a-quote" className="rounded-md bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-navy hover:brightness-110">
          Get a Quote
        </Link>
        <Link href="/designs" className="rounded-md border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
          Browse All Designs
        </Link>
      </div>
    </section>
  );
}
