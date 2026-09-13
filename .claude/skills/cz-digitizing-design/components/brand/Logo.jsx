import React from 'react';

const VARIANTS = {
  light: 'logo-light.png',
  dark: 'logo-dark.png',
  mono: 'logo-mono.png',
  primary: 'logo-primary-dark.png',
  mark: 'mark-dark.png',
  appicon: 'app-icon.png'
};

export function Logo({ variant = 'light', height = 48, assetBase = '../../assets', alt = 'CZ Digitizing', style, ...rest }) {
  const src = assetBase + '/' + (VARIANTS[variant] || VARIANTS.light);
  return <img src={src} alt={alt} style={{ height, width: 'auto', display: 'block', ...style }} {...rest} />;
}
