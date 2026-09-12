import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function SidebarNav({ items = [], value, onChange, footer, header, width = 'var(--sidebar-w)', style, ...rest }) {
  return (
    <nav style={{ width, flex: '0 0 auto', background: 'var(--surface-navy)', color: 'var(--text-on-navy)', display: 'flex', flexDirection: 'column', ...style }} {...rest}>
      {header}
      <div style={{ display: 'grid', gap: 2, padding: 'var(--space-4) var(--space-3)', flex: 1, alignContent: 'start' }}>
        {items.map((it, i) => {
          if (it.section) return (
            <div key={'s' + i} style={{
              padding: i === 0 ? '0 11px 8px' : '18px 11px 8px',
              fontSize: 9, fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-widest)',
              textTransform: 'uppercase', color: 'rgba(250,250,250,.34)'
            }}>{it.section}</div>
          );
          const active = it.value === value;
          return (
            <button key={it.value} onClick={() => onChange && onChange(it.value)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 11px',
              borderRadius: 'var(--radius-sm)', border: 0, cursor: 'pointer', textAlign: 'left',
              background: active ? 'var(--gold-500)' : 'transparent',
              color: active ? 'var(--navy-800)' : 'var(--text-on-navy-muted)',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)',
              fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              transition: 'var(--transition-control)'
            }}>
              <Icon name={it.icon} size={15} />{it.label}
            </button>
          );
        })}
      </div>
      {footer}
    </nav>
  );
}
