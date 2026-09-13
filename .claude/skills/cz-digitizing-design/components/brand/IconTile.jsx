import React from 'react';
import { Icon } from './Icon.jsx';

export function IconTile({ icon, size = 44, tone = 'goldOutline', shape = 'circle', children, style, ...rest }) {
  const tones = {
    goldOutline: { background: 'transparent', border: '1px solid var(--gold-500)', color: 'var(--gold-500)' },
    goldSolid: { background: 'var(--gold-500)', border: '1px solid var(--gold-500)', color: 'var(--navy-800)' },
    goldSoft: { background: 'var(--surface-gold-soft)', border: '1px solid var(--gold-300)', color: 'var(--gold-700)' },
    navy: { background: 'var(--navy-800)', border: '1px solid var(--navy-700)', color: 'var(--gold-500)' },
    onNavy: { background: 'rgba(250,250,250,.06)', border: '1px solid var(--border-on-navy)', color: 'var(--gold-500)' }
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size,
      borderRadius: shape === 'circle' ? 'var(--radius-pill)' : 'var(--radius-md)', flex: '0 0 auto',
      ...tones[tone], ...style
    }} {...rest}>
      {children || <Icon name={icon} size={Math.round(size * 0.45)} />}
    </span>
  );
}
