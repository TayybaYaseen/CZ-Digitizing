import React from 'react';
import { IconTile } from '../brand/IconTile.jsx';

export function FeatureItem({ icon, title, sub, tone = 'onNavy', style, ...rest }) {
  const onNavy = tone === 'onNavy';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', ...style }} {...rest}>
      <IconTile icon={icon} size={34} tone={onNavy ? 'onNavy' : 'goldOutline'} />
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)' }}>{title}</div>
        {sub ? <div style={{ fontSize: 'var(--text-2xs)', color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)' }}>{sub}</div> : null}
      </div>
    </div>
  );
}
