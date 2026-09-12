import React from 'react';

export function CreditPack({ credits, label, price, unit, featured, flag = 'Best Value', style, ...rest }) {
  return (
    <div style={{
      position: 'relative', textAlign: 'center', padding: '18px 12px 16px', borderRadius: 'var(--radius-md)',
      background: featured ? 'var(--surface-gold-soft)' : 'var(--surface-card)',
      border: '1px solid ' + (featured ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: featured ? 'var(--shadow-md)' : 'none', ...style
    }} {...rest}>
      {featured ? <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--gold-500)', color: 'var(--navy-800)', fontSize: 9, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', whiteSpace: 'nowrap' }}>{flag}</span> : null}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)', lineHeight: 1 }}>{credits}</div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--gold-700)', marginTop: 8 }}>{price}</div>
      {unit ? <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>{unit}</div> : null}
    </div>
  );
}
