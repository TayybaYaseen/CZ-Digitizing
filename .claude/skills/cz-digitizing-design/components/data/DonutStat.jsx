import React from 'react';

export function DonutStat({ segments = [], size = 120, thickness = 18, style, ...rest }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map(s => {
    const from = (acc / total) * 100; acc += s.value;
    return `${s.color} ${from}% ${(acc / total) * 100}%`;
  }).join(',');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', ...style }} {...rest}>
      <div style={{ width: size, height: size, borderRadius: '50%', flex: '0 0 auto', background: `conic-gradient(${stops})`, WebkitMask: `radial-gradient(circle, transparent ${size / 2 - thickness}px, #000 ${size / 2 - thickness + 1}px)`, mask: `radial-gradient(circle, transparent ${size / 2 - thickness}px, #000 ${size / 2 - thickness + 1}px)` }} />
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flex: '0 0 auto' }} />
            <span style={{ color: 'var(--text-body)', flex: 1 }}>{s.label}</span>
            <span style={{ color: 'var(--text-strong)', fontWeight: 'var(--weight-semibold)' }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
