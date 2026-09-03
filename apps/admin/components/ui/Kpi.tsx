// Ported from docs/CZ Digitizing Admin Panel.html's decoded DashboardView.jsx `Kpi` tile.
// `accent` raises one tile above the rest — navy ground, gold figure — for the most
// actionable number on the page (e.g. unread notifications, pending items).
export function Kpi({ label, value, delta, accent }: { label: string; value: string; delta?: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-card border px-6 py-5 ${
        accent ? 'border-gold-500 bg-navy-800 shadow-cz-navy' : 'border-gray-200 bg-white shadow-cz-sm'
      }`}
    >
      <div className={`text-[11px] font-semibold uppercase tracking-widest ${accent ? 'text-gold-500' : 'text-gray-500'}`}>{label}</div>
      <div className={`mt-3.5 font-display text-[40px] font-bold leading-none ${accent ? 'text-gold-500' : 'text-navy-800'}`}>{value}</div>
      {delta && <div className={`mt-2 text-xs font-semibold ${accent ? 'text-gold-400' : 'text-status-greenFg'}`}>{delta}</div>}
    </div>
  );
}
