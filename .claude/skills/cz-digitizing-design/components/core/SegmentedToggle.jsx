import React from 'react';

export function SegmentedToggle({ options = [], value, onChange, size = 'md', tone = 'light', style, ...rest }) {
  const s = size === 'sm' ? { h: 26, fs: 'var(--text-2xs)', px: 10 } : { h: 34, fs: 'var(--text-xs)', px: 16 };
  const onNavy = tone === 'navy';
  return (
    <div style={{
      display: 'inline-flex', gap: 2, padding: 3, borderRadius: 'var(--radius-pill)',
      background: onNavy ? 'rgba(250,250,250,.07)' : 'var(--surface-sunken)', ...style
    }} {...rest}>
      {options.map(o => {
        const key = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const active = key === value;
        return (
          <button key={key} onClick={() => onChange && onChange(key)} style={{
            height: s.h, padding: `0 ${s.px}px`, borderRadius: 'var(--radius-pill)', border: 0, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: s.fs, fontWeight: 'var(--weight-semibold)',
            letterSpacing: 'var(--tracking-wide)',
            background: active ? 'var(--gold-500)' : 'transparent',
            color: active ? 'var(--navy-800)' : (onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)'),
            transition: 'var(--transition-control)', whiteSpace: 'nowrap'
          }}>{label}</button>
        );
      })}
    </div>
  );
}
