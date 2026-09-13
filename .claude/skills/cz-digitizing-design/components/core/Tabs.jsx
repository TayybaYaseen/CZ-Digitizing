import React from 'react';

export function Tabs({ tabs = [], value, onChange, tone = 'light', style, ...rest }) {
  const onNavy = tone === 'navy';
  return (
    <div role="tablist" style={{ display: 'flex', gap: 'var(--space-5)', borderBottom: `1px solid ${onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'}`, ...style }} {...rest}>
      {tabs.map(t => {
        const key = typeof t === 'string' ? t : t.value;
        const label = typeof t === 'string' ? t : t.label;
        const active = key === value;
        return (
          <button key={key} role="tab" aria-selected={active} onClick={() => onChange && onChange(key)}
            style={{
              background: 'none', border: 0, padding: '10px 0 11px', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
              fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              color: active ? (onNavy ? 'var(--gold-500)' : 'var(--text-strong)') : (onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)'),
              boxShadow: active ? 'inset 0 -2px 0 var(--gold-500)' : 'none',
              transition: 'var(--transition-control)', whiteSpace: 'nowrap'
            }}>{label}</button>
        );
      })}
    </div>
  );
}
