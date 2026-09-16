// docs/portfolio-spec.md §5.11/§8 — horizontally-scrollable pill row on mobile (no dropdown),
// wrapping row on desktop/tablet. Built from the categories actually present among published work
// samples, so no empty filter pill ever appears.
export function PortfolioCategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-sm ${
          selected === null ? 'border-brand-gold bg-brand-gold text-brand-navy' : 'border-gray-300 bg-white text-gray-600 hover:border-brand-navy'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          aria-pressed={selected === category}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-sm ${
            selected === category ? 'border-brand-gold bg-brand-gold text-brand-navy' : 'border-gray-300 bg-white text-gray-600 hover:border-brand-navy'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
