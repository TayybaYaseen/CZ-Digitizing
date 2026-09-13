import React from 'react';
import { Icon } from '../brand/Icon.jsx';

const TINTS = {
  green: { bg: 'var(--green-100)', fg: 'var(--green-600)' },
  blue: { bg: 'var(--blue-100)', fg: 'var(--blue-600)' },
  gold: { bg: 'var(--surface-gold-soft)', fg: 'var(--gold-700)' },
  red: { bg: 'var(--red-100)', fg: 'var(--red-600)' },
  violet: { bg: 'var(--violet-100)', fg: 'var(--violet-600)' },
  navy: { bg: 'var(--gray-200)', fg: 'var(--navy-800)' }
};

export function StatCard({ label, value, delta, deltaTone = 'up', icon, tint = 'gold', note, style, ...rest }) {
  const t = TINTS[tint] || TINTS.gold;
  const deltaColor = deltaTone === 'up' ? 'var(--green-600)' : deltaTone === 'down' ? 'var(--red-600)' : 'var(--amber-600)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--card-pad-sm)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', ...style }} {...rest}>
      {icon ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 'var(--radius-md)', background: t.bg, color: t.fg, flex: '0 0 auto' }}><Icon name={icon} size={17} /></span> : null}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)', lineHeight: 1.15, marginTop: 2 }}>{value}</div>
        {delta ? <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', color: deltaColor, marginTop: 2 }}>{delta}</div> : null}
        {note ? <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', marginTop: 2 }}>{note}</div> : null}
      </div>
    </div>
  );
}
