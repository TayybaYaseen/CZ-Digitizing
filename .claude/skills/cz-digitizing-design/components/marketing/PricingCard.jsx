import React from 'react';
import { Icon } from '../brand/Icon.jsx';
import { Button } from '../core/Button.jsx';

export function PricingCard({ name, price, period = '/ month', blurb, features = [], featured, ribbon = 'Most Popular', ctaLabel = 'Choose Plan', style, ...rest }) {
  return (
    <div style={{
      position: 'relative', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-card)',
      border: '1px solid ' + (featured ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: featured ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      ...style
    }} {...rest}>
      {featured ? (
        <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--gold-500)', color: 'var(--navy-800)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)', whiteSpace: 'nowrap' }}>{ribbon}</span>
      ) : null}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4)', fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>{name}</div>
      {blurb ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 3 }}>{blurb}</div> : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '14px 0 16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 'var(--weight-bold)', color: featured ? 'var(--gold-600)' : 'var(--text-strong)', lineHeight: 1 }}>{price}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{period}</span>
      </div>
      <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, display: 'grid', gap: 8 }}>
        {features.map((ft, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-body)' }}>
            <span style={{ color: 'var(--green-600)', display: 'inline-flex', marginTop: 1 }}><Icon name="check" size={13} /></span>{ft}
          </li>
        ))}
      </ul>
      <Button variant={featured ? 'primary' : 'outlineNavy'} block>{ctaLabel}</Button>
    </div>
  );
}
