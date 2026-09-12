import React from 'react';

function toEmoji(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export function FlagChip({ flag, label, size = 20, style, ...rest }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }} {...rest}>
      <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>{toEmoji(flag)}</span>
      {label ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>{label}</span> : null}
    </span>
  );
}
