import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function Input({ icon, size = 'md', invalid, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'sm' ? 'var(--field-h-sm)' : 'var(--field-h)';
  const field = (
    <input onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', height: h, padding: icon ? '0 12px 0 34px' : '0 12px',
        fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-field)',
        border: '1px solid ' + (invalid ? 'var(--red-600)' : focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
        boxShadow: focus ? 'var(--ring-focus)' : 'none', outline: 'none',
        transition: 'var(--transition-control)', ...style
      }} {...rest} />
  );
  if (!icon) return field;
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', display: 'inline-flex' }}><Icon name={icon} size={15} /></span>
      {field}
    </span>
  );
}
