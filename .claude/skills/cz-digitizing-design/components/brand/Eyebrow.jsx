import React from 'react';

export function Eyebrow({ children, tone = 'gold', rules = false, style, ...rest }) {
  const color = tone === 'gold' ? 'var(--text-accent)' : tone === 'onNavy' ? 'var(--text-on-navy-muted)' : 'var(--text-muted)';
  const label = (
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 'var(--eyebrow-size)', fontWeight: 'var(--eyebrow-weight)',
      letterSpacing: 'var(--eyebrow-tracking)', textTransform: 'uppercase', color, whiteSpace: 'nowrap'
    }}>{children}</span>
  );
  if (!rules) return <div style={{ display: 'flex', ...style }} {...rest}>{label}</div>;
  const rule = <span style={{ flex: 1, height: 1, background: 'var(--rule-gold)', opacity: .7 }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', ...style }} {...rest}>{rule}{label}{rule}</div>
  );
}
