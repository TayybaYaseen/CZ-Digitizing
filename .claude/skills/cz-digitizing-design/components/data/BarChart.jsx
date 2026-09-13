import React from 'react';

export function BarChart({ data = [], height = 140, color = 'var(--gold-500)', style, ...rest }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, ...style }} {...rest}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 26, height: `${(d.value / max) * 100}%`, background: color, borderRadius: '3px 3px 0 0' }} />
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
