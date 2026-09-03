import type { ReactNode } from 'react';

// Ported from docs/CZ Digitizing Admin Panel.html's design-system Card.jsx (decoded from the
// bundled artifact) — white surface, 10px radius, subtle shadow, optional title+action header.
export function Card({
  title,
  action,
  tone = 'light',
  padding = 'p-5',
  className = '',
  children,
}: {
  title?: string;
  action?: ReactNode;
  tone?: 'light' | 'navy' | 'gold';
  padding?: string;
  className?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'navy'
      ? 'bg-navy-800 border-white/10 text-white shadow-cz-navy'
      : tone === 'gold'
        ? 'bg-gold-100 border-gold-300 text-gold-700'
        : 'bg-white border-gray-200 text-gray-700 shadow-cz-sm';

  return (
    <section className={`overflow-hidden rounded-card border ${toneClass} ${className}`}>
      {(title || action) && (
        <header className={`flex items-center justify-between gap-3 ${padding} pb-0`}>
          <h4 className={`font-display text-xl font-bold ${tone === 'navy' ? 'text-white' : 'text-navy-800'}`}>{title}</h4>
          {action}
        </header>
      )}
      <div className={padding}>{children}</div>
    </section>
  );
}
