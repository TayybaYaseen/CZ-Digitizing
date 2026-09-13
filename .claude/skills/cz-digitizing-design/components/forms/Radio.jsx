import React from 'react';

export function Radio({ checked, onChange, label, disabled, style, ...rest }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, ...style }} {...rest}>
      <span onClick={() => !disabled && onChange && onChange(true)} style={{
        width: 18, height: 18, flex: '0 0 auto', borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid ' + (checked ? 'var(--gold-500)' : 'var(--border-strong)'),
        transition: 'var(--transition-control)'
      }}>{checked ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--gold-500)' }} /> : null}</span>
      {label ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{label}</span> : null}
    </label>
  );
}
