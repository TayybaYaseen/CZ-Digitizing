import React from 'react';
import { Icon } from '../brand/Icon.jsx';

const TINTS = {
  green: { bg: 'var(--green-100)', fg: 'var(--green-600)' },
  blue: { bg: 'var(--blue-100)', fg: 'var(--blue-600)' },
  gold: { bg: 'var(--surface-gold-soft)', fg: 'var(--gold-700)' },
  red: { bg: 'var(--red-100)', fg: 'var(--red-600)' },
  violet: { bg: 'var(--violet-100)', fg: 'var(--violet-600)' },
  neutral: { bg: 'var(--gray-200)', fg: 'var(--text-muted)' }
};

export function ActivityRow({ icon = 'activity', tint = 'neutral', title, meta, time, divider = true, style, ...rest }) {
  const t = TINTS[tint] || TINTS.neutral;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: '10px 0', borderBottom: divider ? '1px solid var(--border-subtle)' : 'none', ...style }} {...rest}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 'var(--radius-pill)', background: t.bg, color: t.fg, flex: '0 0 auto' }}><Icon name={icon} size={14} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>{title}</div>
        {meta ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{meta}</div> : null}
      </div>
      {time ? <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{time}</span> : null}
    </div>
  );
}
