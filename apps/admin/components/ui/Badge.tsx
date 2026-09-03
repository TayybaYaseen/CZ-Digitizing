import type { ReactNode } from 'react';

// Ported from docs/CZ Digitizing Admin Panel.html's design-system Badge.jsx tones.
const TONES = {
  success: 'bg-status-greenBg text-status-greenFg',
  warning: 'bg-status-amberBg text-status-amberFg',
  danger: 'bg-status-redBg text-status-redFg',
  info: 'bg-status-blueBg text-status-blueFg',
  gold: 'bg-gold-100 text-gold-700',
  neutral: 'bg-gray-200 text-gray-600',
} as const;

export function Badge({ tone = 'neutral', dot, children }: { tone?: keyof typeof TONES; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
