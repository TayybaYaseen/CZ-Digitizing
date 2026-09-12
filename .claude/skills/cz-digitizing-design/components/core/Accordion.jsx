import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function Accordion({ items = [], defaultOpen = -1, style, ...rest }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)', ...style }} {...rest}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', overflow: 'hidden' }}>
            <button onClick={() => setOpen(isOpen ? -1 : i)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
              padding: '12px var(--space-4)', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-strong)'
            }}>
              {it.q}
              <span style={{ color: 'var(--gold-600)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: `transform var(--dur-normal) var(--ease-standard)`, display: 'inline-flex' }}>
                <Icon name="chevron-down" size={16} />
              </span>
            </button>
            {isOpen ? <div style={{ padding: '0 var(--space-4) 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{it.a}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
