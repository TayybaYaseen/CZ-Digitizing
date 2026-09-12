import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function FileField({ buttonLabel = 'Choose File', fileName = 'No file chosen', style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', ...style }} {...rest}>
      <span onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 'var(--field-h-sm)', padding: '0 12px',
        borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)',
        background: hover ? 'var(--gray-100)' : 'var(--surface-card)',
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)',
        transition: 'var(--transition-control)'
      }}><Icon name="upload" size={13} />{buttonLabel}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>{fileName}</span>
      <input type="file" style={{ display: 'none' }} />
    </label>
  );
}
