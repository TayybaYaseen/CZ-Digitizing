// Shared section heading used by every CV-content section (docs/portfolio-spec.md §5, §7) so the
// primary/secondary visual-hierarchy rule stays consistent instead of each section inventing its
// own heading scale. `weight="primary"` (embroidery/digitizing content, §5.3–§5.5) renders larger
// than `weight="secondary"` (textile/sourcing/audit content, §5.6–§5.7, §5.10) — same section
// shell, different scale, per §7's explicit requirement that secondary content stay fully present
// but visibly smaller, never trimmed.
export function PortfolioSectionHeading({
  eyebrow,
  title,
  weight = 'primary',
}: {
  eyebrow?: string;
  title: string;
  weight?: 'primary' | 'secondary';
}) {
  return (
    <div className={weight === 'secondary' ? 'mb-4' : 'mb-6'}>
      {eyebrow && <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">{eyebrow}</p>}
      <h2 className={weight === 'secondary' ? 'mt-1 font-display text-xl font-bold text-brand-navy sm:text-2xl' : 'mt-1 font-display text-2xl font-bold text-brand-navy sm:text-3xl'}>
        {title}
      </h2>
      <div className={weight === 'secondary' ? 'mt-2 h-px w-10 bg-brand-gold/60' : 'mt-3 h-px w-14 bg-brand-gold'} />
    </div>
  );
}
