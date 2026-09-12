import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function Checkbox({ checked, onChange, label, tone = 'light', disabled, style, ...rest }) {
  const onNavy = tone === 'navy';
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, ...style }} {...rest}>
      <span onClick={() => !disabled && onChange && onChange(!checked)} style={{
        width: 18, height: 18, flex: '0 0 auto', borderRadius: 'var(--radius-xs)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: checked ? 'var(--gold-500)' : 'transparent',
        border: '1px solid ' + (checked ? 'var(--gold-500)' : onNavy ? 'rgba(250,250,250,.3)' : 'var(--border-strong)'),
        color: 'var(--navy-800)', transition: 'var(--transition-control)'
      }}>{checked ? <Icon name="check" size={13} /> : null}</span>
      {label ? <span style={{ fontSize: 'var(--text-sm)', color: onNavy ? 'var(--text-on-navy)' : 'var(--text-body)' }}>{label}</span> : null}
    </label>
  );
}
