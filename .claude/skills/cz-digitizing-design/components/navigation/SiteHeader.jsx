import React from 'react';
import { Logo } from '../brand/Logo.jsx';
import { Icon } from '../brand/Icon.jsx';

export function SiteHeader({ links = [], active, onNavigate, assetBase = '../../assets', right, cartCount, style, ...rest }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: '0 var(--space-6)', height: 60,
      background: 'var(--surface-navy)', borderBottom: '1px solid var(--border-on-navy)', ...style
    }} {...rest}>
      <Logo variant="dark" height={34} assetBase={assetBase} />
      <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginLeft: 'auto' }}>
        {links.map(l => {
          const key = typeof l === 'string' ? l : l.value;
          const label = typeof l === 'string' ? l : l.label;
          const isActive = key === active;
          return (
            <button key={key} onClick={() => onNavigate && onNavigate(key)} style={{
              background: 'none', border: 0, padding: '4px 0', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)',
              fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              letterSpacing: 'var(--tracking-wide)',
              color: isActive ? 'var(--gold-500)' : 'var(--text-on-navy)',
              boxShadow: isActive ? 'inset 0 -2px 0 var(--gold-500)' : 'none',
              transition: 'var(--transition-control)', whiteSpace: 'nowrap'
            }}>{label}</button>
          );
        })}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', color: 'var(--text-on-navy)' }}>
        {typeof cartCount === 'number' ? (
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Icon name="shopping-cart" size={17} />
            <span style={{ position: 'absolute', top: -6, right: -8, minWidth: 15, height: 15, borderRadius: 'var(--radius-pill)', background: 'var(--gold-500)', color: 'var(--navy-800)', fontSize: 9, fontWeight: 'var(--weight-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
          </span>
        ) : null}
        {right}
      </div>
    </header>
  );
}
