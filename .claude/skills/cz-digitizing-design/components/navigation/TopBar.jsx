import React from 'react';

export function TopBar({ title, subtitle, right, tone = 'light', style, ...rest }) {
  const onNavy = tone === 'navy';
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
      minHeight: 'var(--topbar-h)', padding: '0 var(--space-6)',
      background: onNavy ? 'var(--surface-navy)' : 'var(--surface-card)',
      borderBottom: '1px solid ' + (onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'), ...style
    }} {...rest}>
      <div>
        <h3 style={{ fontSize: 'var(--text-h3)', color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)' }}>{title}</h3>
        {subtitle ? <div style={{ fontSize: 'var(--text-xs)', color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>{right}</div>
    </header>
  );
}
