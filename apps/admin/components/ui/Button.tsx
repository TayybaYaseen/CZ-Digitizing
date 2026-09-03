import type { ButtonHTMLAttributes } from 'react';

// Ported from docs/CZ Digitizing Admin Panel.html's design-system Button.jsx variant tones.
const VARIANTS = {
  primary: 'bg-gold-500 text-navy-800 hover:brightness-105 shadow-sm',
  secondary: 'bg-navy-800 text-white hover:bg-navy-700 shadow-sm',
  outline: 'bg-transparent text-gold-700 border border-gold-500 hover:bg-gold-100',
  outlineNavy: 'bg-transparent text-gray-700 border border-gray-400 hover:bg-gray-100',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-200',
} as const;

const SIZES = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-field font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
