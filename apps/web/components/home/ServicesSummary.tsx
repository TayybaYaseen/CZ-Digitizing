import Link from 'next/link';

// SRS §6 — Embroidery Digitizing / Vector Art service highlight. TODO(A-014): the Services Module
// itself is still Blocked (SPEC_INDEX.md), so these cards link to /services which 404s for now,
// same posture as Header.tsx's existing Services nav link. Always renders (AC-8 empty-state floor).
const SERVICES = [
  { title: 'Embroidery Digitizing', description: 'Professional conversion of artwork into machine-ready embroidery files.' },
  { title: 'Vector Art', description: 'Clean, scalable artwork for branding, printing and production.' },
];

export function ServicesSummary() {
  return (
    <section className="space-y-4">
      <h2 className="text-center font-display text-xl font-bold text-brand-navy">Our Services</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Link key={s.title} href="/services" className="rounded-lg border border-gray-200 bg-white p-6 text-center hover:border-brand-gold">
            <h3 className="font-display text-lg font-semibold text-brand-navy">{s.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{s.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
