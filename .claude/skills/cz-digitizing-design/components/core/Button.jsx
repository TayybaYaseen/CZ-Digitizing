import React from 'react';
import { Icon } from '../brand/Icon.jsx';

const SIZES = {
  sm: { height: 32, padding: '0 14px', fontSize: 'var(--text-xs)' },
  md: { height: 40, padding: '0 20px', fontSize: 'var(--text-sm)' },
  lg: { height: 48, padding: '0 28px', fontSize: 'var(--text-md)' }
};

function tone(variant, hover) {
  switch (variant) {
    case 'primary': return { background: hover ? 'var(--action-primary-hover)' : 'var(--action-primary)', color: 'var(--text-on-gold)', border: '1px solid transparent', boxShadow: hover ? 'var(--shadow-gold)' : 'var(--shadow-xs)' };
    case 'secondary': return { background: hover ? 'var(--action-secondary-hover)' : 'var(--action-secondary)', color: 'var(--text-on-navy)', border: '1px solid transparent', boxShadow: 'var(--shadow-xs)' };
    case 'outline': return { background: hover ? 'var(--gold-100)' : 'transparent', color: 'var(--gold-700)', border: '1px solid var(--gold-500)', boxShadow: 'none' };
    case 'outlineNavy': return { background: hover ? 'var(--gray-100)' : 'transparent', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', boxShadow: 'none' };
    case 'onNavy': return { background: hover ? 'rgba(250,250,250,.12)' : 'rgba(250,250,250,.06)', color: 'var(--text-on-navy)', border: '1px solid var(--border-on-navy)', boxShadow: 'none' };
    case 'ghost': return { background: hover ? 'var(--gray-200)' : 'transparent', color: 'var(--text-body)', border: '1px solid transparent', boxShadow: 'none' };
    default: return {};
  }
}

export function Button({ variant = 'primary', size = 'md', icon, iconAfter, block, disabled, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const t = tone(variant, hover && !disabled);
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{
        display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined,
        alignItems: 'center', justifyContent: 'center', gap: 'var(--control-gap)',
        fontFamily: 'var(--font-body)', fontWeight: 'var(--weight-semibold)',
        letterSpacing: 'var(--tracking-wide)', borderRadius: 'var(--radius-button)',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'var(--transition-control), transform var(--dur-instant) var(--ease-standard)',
        transform: down && !disabled ? 'translateY(1px)' : 'none',
        ...SIZES[size], ...t,
        ...(disabled ? { background: 'var(--action-disabled)', color: 'var(--text-faint)', border: '1px solid transparent', boxShadow: 'none' } : null),
        ...style
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'lg' ? 18 : 15} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={size === 'lg' ? 18 : 15} /> : null}
    </button>
  );
}
