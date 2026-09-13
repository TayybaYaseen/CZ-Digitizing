import React from 'react';

export function LineChart({ data = [], height = 240, color = 'var(--gold-500)', valueFormat, gridLines = 4, style, ...rest }) {
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 1);
  const min = 0;
  const W = 1000, H = 300, padL = 8, padR = 8, padT = 14, padB = 8;
  const x = i => padL + (i / Math.max(data.length - 1, 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L ${pts[0][0].toFixed(1)} ${H - padB} Z`;
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => min + (max - min) * (i / gridLines));
  const fmt = valueFormat || (v => Math.round(v));
  const gid = React.useId ? React.useId().replace(/:/g, '') : 'lcg';
  return (
    <div style={{ ...style }} {...rest}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height, paddingTop: 4, paddingBottom: 22, flex: '0 0 auto' }}>
          {ticks.slice().reverse().map((t, i) => (
            <span key={i} style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', lineHeight: 1, whiteSpace: 'nowrap' }}>{fmt(t)}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: height - 22, overflow: 'visible' }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity=".18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t, i) => (
              <line key={i} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--surface-card)" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {data.map(d => <span key={d.label} style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>{d.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
