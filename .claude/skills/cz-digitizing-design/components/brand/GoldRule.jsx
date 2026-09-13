import React from 'react';

export function GoldRule({ width = '100%', thickness = 1, fade = false, style, ...rest }) {
  const background = fade
    ? 'linear-gradient(90deg,rgba(212,175,55,0) 0%,var(--gold-500) 50%,rgba(212,175,55,0) 100%)'
    : 'var(--rule-gold)';
  return <hr style={{ width, height: thickness, border: 0, margin: 0, background, ...style }} {...rest} />;
}
