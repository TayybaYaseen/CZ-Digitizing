import React from 'react';
import { FlagChip } from './FlagChip.jsx';

export function TestimonialCard({ quote, name, country, flag, style, ...rest }) {
  return (
    <figure style={{ margin: 0, padding: 'var(--card-pad-sm)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-xs)', ...style }} {...rest}>
      <blockquote style={{ margin: 0, fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--text-body)' }}>&ldquo;{quote}&rdquo;</blockquote>
      <figcaption style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        {flag ? <FlagChip flag={flag} /> : null}
        <span>
          <span style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>{name}</span>
          <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>{country}</span>
        </span>
      </figcaption>
    </figure>
  );
}
