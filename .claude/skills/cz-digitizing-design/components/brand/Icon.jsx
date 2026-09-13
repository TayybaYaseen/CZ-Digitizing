import React from 'react';

const CDN = 'https://unpkg.com/lucide-static@0.544.0/icons/';

/* Lucide outline icons stand in for the brand kit's gold line icons (see readme
   ICONOGRAPHY). Rendered as a CSS mask so the glyph inherits currentColor. */
export function Icon({ name, size = 18, strokeColor = 'currentColor', style, ...rest }) {
  const url = `url("${CDN}${name}.svg")`;
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', width: size, height: size, flex: '0 0 auto',
      background: strokeColor, WebkitMaskImage: url, maskImage: url,
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center', maskPosition: 'center',
      WebkitMaskSize: 'contain', maskSize: 'contain', ...style
    }} {...rest} />
  );
}
