import React from 'react';

export function DataTable({ columns = [], rows = [], dense = false, style, ...rest }) {
  const pad = dense ? '8px 12px' : '11px 14px';
  return (
    <div style={{ overflowX: 'auto', ...style }} {...rest}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)' }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || 'left', padding: pad, whiteSpace: 'nowrap',
                fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)',
                background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', width: c.width
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {columns.map((c, ci) => (
                <td key={ci} style={{
                  textAlign: c.align || 'left', padding: pad, fontSize: 'var(--text-sm)',
                  color: ci === 0 ? 'var(--text-muted)' : 'var(--text-body)',
                  fontWeight: c.strong ? 'var(--weight-semibold)' : 'var(--weight-regular)',
                  whiteSpace: c.wrap ? 'normal' : 'nowrap'
                }}>{typeof c.cell === 'function' ? c.cell(r, ri) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
