import React from 'react';

export function FormField({ label, required, hint, error, htmlFor, children, style, ...rest }) {
  return (
    <div style={{ display: 'grid', gap: 6, ...style }} {...rest}>
      {label ? (
        <label htmlFor={htmlFor} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
          {label}{required ? <span style={{ color: 'var(--gold-600)' }}> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--red-600)' }}>{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>{hint}</span> : null}
    </div>
  );
}
