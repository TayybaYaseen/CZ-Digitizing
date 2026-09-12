import React from 'react';

export function Card({ title, action, tone = 'light', padding = 'var(--card-pad)', bodyStyle, children, style, ...rest }) {
  const tones = {
    light: { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-body)', boxShadow: 'var(--shadow-sm)' },
    navy: { background: 'var(--surface-navy)', border: '1px solid var(--border-on-navy)', color: 'var(--text-on-navy)', boxShadow: 'var(--shadow-navy)' },
    gold: { background: 'var(--surface-gold-soft)', border: '1px solid var(--gold-300)', color: 'var(--gold-700)', boxShadow: 'none' },
    flat: { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-body)', boxShadow: 'none' }
  };
  const t = tones[tone] || tones.light;
  return (
    <section style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', ...t, ...style }} {...rest}>
      {title || action ? (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: `var(--space-4) ${padding} 0` }}>
          <h4 style={{ fontSize: 'var(--text-h4)', color: tone === 'navy' ? 'var(--text-on-navy)' : 'var(--text-strong)' }}>{title}</h4>
          {action}
        </header>
      ) : null}
      <div style={{ padding, ...bodyStyle }}>{children}</div>
    </section>
  );
}
