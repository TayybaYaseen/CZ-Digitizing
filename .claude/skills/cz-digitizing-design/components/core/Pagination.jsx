import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function Pagination({ page = 1, pages = 1, onChange, summary, style, ...rest }) {
  const nums = [];
  for (let i = 1; i <= Math.min(pages, 4); i++) nums.push(i);
  const btn = (content, key, opts = {}) => (
    <button key={key} disabled={opts.disabled} onClick={() => opts.to && onChange && onChange(opts.to)} style={{
      minWidth: 28, height: 28, padding: '0 6px', borderRadius: 'var(--radius-sm)', cursor: opts.disabled ? 'default' : 'pointer',
      border: '1px solid ' + (opts.active ? 'var(--gold-500)' : 'var(--border-subtle)'),
      background: opts.active ? 'var(--gold-500)' : 'var(--surface-card)',
      color: opts.active ? 'var(--navy-800)' : (opts.disabled ? 'var(--text-faint)' : 'var(--text-body)'),
      fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--transition-control)'
    }}>{content}</button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', ...style }} {...rest}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{summary}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {btn(<Icon name="chevron-left" size={13} />, 'prev', { disabled: page === 1, to: page - 1 })}
        {nums.map(n => btn(n, n, { active: n === page, to: n }))}
        {pages > 4 ? <span key="e" style={{ alignSelf: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-xs)' }}>…</span> : null}
        {btn(<Icon name="chevron-right" size={13} />, 'next', { disabled: page === pages, to: page + 1 })}
      </div>
    </div>
  );
}
