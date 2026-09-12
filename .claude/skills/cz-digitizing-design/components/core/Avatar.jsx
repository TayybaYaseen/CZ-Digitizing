import React from 'react';

export function Avatar({ src, name = '', size = 36, shape = 'circle', ring = false, style, ...rest }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flex: '0 0 auto',
      borderRadius: shape === 'circle' ? 'var(--radius-avatar)' : 'var(--radius-md)', overflow: 'hidden',
      background: 'var(--navy-700)', color: 'var(--gold-500)', fontFamily: 'var(--font-display)',
      fontSize: Math.round(size * 0.38), fontWeight: 'var(--weight-bold)', letterSpacing: '.02em',
      boxShadow: ring ? '0 0 0 2px var(--gold-500)' : 'none', ...style
    }} {...rest}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
}
