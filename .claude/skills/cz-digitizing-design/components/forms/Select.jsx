import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function Select({ options = [], size = 'md', placeholder, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <select onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: '100%', height: size === 'sm' ? 'var(--field-h-sm)' : 'var(--field-h)',
          padding: '0 32px 0 12px', appearance: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)',
          background: 'var(--surface-card)', borderRadius: 'var(--radius-field)',
          border: '1px solid ' + (focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
          boxShadow: focus ? 'var(--ring-focus)' : 'none', outline: 'none',
          transition: 'var(--transition-control)', ...style
        }} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(o => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
      <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'inline-flex' }}><Icon name="chevron-down" size={15} /></span>
    </span>
  );
}
