import React from 'react';
import { Icon } from '../brand/Icon.jsx';

const TONES = {
  gold: { bg: 'var(--gold-500)', fg: 'var(--navy-800)' },
  goldSoft: { bg: 'var(--surface-gold-soft)', fg: 'var(--gold-700)' },
  navy: { bg: 'var(--navy-800)', fg: 'var(--cz-white)' },
  neutral: { bg: 'var(--gray-200)', fg: 'var(--text-muted)' },
  success: { bg: 'var(--status-paid-bg)', fg: 'var(--status-paid-fg)' },
  warning: { bg: 'var(--status-pending-bg)', fg: 'var(--status-pending-fg)' },
  danger: { bg: 'var(--status-failed-bg)', fg: 'var(--status-failed-fg)' },
  info: { bg: 'var(--status-progress-bg)', fg: 'var(--status-progress-fg)' }
};

export function Badge({ tone = 'neutral', icon, dot, size = 'md', children, style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  const s = size === 'sm' ? { fontSize: 'var(--text-2xs)', padding: '2px 8px' } : { fontSize: 'var(--text-xs)', padding: '4px 10px' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 'var(--radius-badge)', background: t.bg, color: t.fg, fontWeight: 'var(--weight-semibold)', lineHeight: 1.4, whiteSpace: 'nowrap', ...s, ...style }} {...rest}>
      {dot ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
