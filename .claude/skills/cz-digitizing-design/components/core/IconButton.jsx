import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function IconButton({ icon, label, size = 36, variant = 'ghost', badge, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const tones = {
    ghost: { background: hover ? 'var(--gray-200)' : 'transparent', color: 'var(--text-body)', border: '1px solid transparent' },
    outline: { background: hover ? 'var(--gray-100)' : 'var(--surface-card)', color: 'var(--text-body)', border: '1px solid var(--border-subtle)' },
    gold: { background: hover ? 'var(--action-primary-hover)' : 'var(--action-primary)', color: 'var(--text-on-gold)', border: '1px solid transparent' },
    onNavy: { background: hover ? 'rgba(250,250,250,.12)' : 'transparent', color: 'var(--text-on-navy)', border: '1px solid transparent' }
  };
  return (
    <button aria-label={label} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--transition-control)', ...tones[variant], ...style }} {...rest}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
      {badge ? <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 'var(--radius-pill)', background: 'var(--red-600)', color: '#fff', fontSize: 9, fontWeight: 'var(--weight-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
    </button>
  );
}
