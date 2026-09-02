// docs/specs/2026-09-02-01-brand-visual-identity.md AC-3 — no logo image asset has been supplied
// (see spec §1/§8); this text wordmark is a deliberate placeholder isolated behind one component
// so the real mark can replace it later without touching every call site.
export function Logo({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const titleColor = variant === 'dark' ? 'text-white' : 'text-brand-navy';
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`text-lg font-bold tracking-tight ${titleColor}`}>
        CZ <span className="text-brand-gold">Digitizing</span>
      </span>
      <span className="text-[9px] font-medium tracking-[0.2em] text-brand-silver">MACHINE EMBROIDERY DESIGN</span>
    </span>
  );
}
