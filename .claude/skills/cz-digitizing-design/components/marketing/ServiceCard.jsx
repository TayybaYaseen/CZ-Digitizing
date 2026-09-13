import React from 'react';
import { Icon } from '../brand/Icon.jsx';

export function ServiceCard({ image, title, description, linkLabel = 'View Service', tone = 'light', style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const onNavy = tone === 'navy';
  return (
    <a href="#" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', textDecoration: 'none', borderRadius: 'var(--radius-card)', overflow: 'hidden',
        background: onNavy ? 'var(--surface-navy-raised)' : 'var(--surface-card)',
        border: '1px solid ' + (hover ? 'var(--gold-500)' : onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'),
        boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'var(--transition-control), transform var(--dur-normal) var(--ease-out)', ...style
      }} {...rest}>
      {image ? <img src={image} alt="" style={{ display: 'block', width: '100%', height: 118, objectFit: 'cover' }} /> : null}
      <div style={{ padding: 'var(--card-pad-sm)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)' }}>{title}</div>
        {description ? <div style={{ fontSize: 'var(--text-xs)', color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{description}</div> : null}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--gold-600)' }}>
          {linkLabel}<Icon name="arrow-right" size={13} />
        </span>
      </div>
    </a>
  );
}
