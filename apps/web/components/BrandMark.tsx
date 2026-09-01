import { brand } from '@/lib/brand';

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke={brand.accent} strokeWidth="1.8" />
        <path d="M7 8h10M7 12h10M7 16h6" stroke={brand.accent} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="font-serif text-[19px] font-bold tracking-tight text-slate-900">{brand.name}</span>
    </div>
  );
}
