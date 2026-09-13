import React from 'react';

export function Textarea({ rows = 4, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea rows={rows} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', padding: '10px 12px', resize: 'vertical',
        fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', lineHeight: 'var(--lh-sm)', color: 'var(--text-strong)',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-field)',
        border: '1px solid ' + (focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
        boxShadow: focus ? 'var(--ring-focus)' : 'none', outline: 'none',
        transition: 'var(--transition-control)', ...style
      }} {...rest} />
  );
}
