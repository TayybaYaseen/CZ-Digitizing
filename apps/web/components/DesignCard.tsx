'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

// Mirrors apps/api/src/designs/dto/design.dto.ts's DesignSummaryDto.
export interface DesignSummaryDto {
  id: string;
  name: string;
  previewImageUrl: string;
  categoryIds: string[];
  subcategoryId: string | null;
  tags: string[];
  pricePkr: number;
  salePricePkr: number | null;
  discountBadge: string | null;
  isFavorited: boolean;
  vectorImageUrl: string | null;
  vectorVideoUrl: string | null;
  embroideryImageUrl: string | null;
  embroideryVideoUrl: string | null;
  autoSwapEnabled: boolean;
}

// Mirrors apps/api/src/designs/dto/design.dto.ts's DesignDetailDto — only the fields the card
// back needs (AC-4). Fetched lazily on first flip so the grid's initial load stays cheap.
interface DesignBackDetail {
  description: string | null;
  sizes: { id: string; label: string; widthMm: number; heightMm: number }[];
  stitchCount: number | null;
  threadColorCount: number | null;
  threadColorChanges: number | null;
}

const AUTO_SWAP_INTERVAL_MS = 2000; // AC-5

// AC-3 — the front of every card must show its category/subcategory tag. categoryIds/
// subcategoryId are ids only, so names are resolved from these two module-level caches, fetched
// once and shared across every DesignCard instance on the page rather than once per card.
let categoryNameCache: Promise<Map<string, string>> | null = null;
let subcategoryNameCache: Promise<Map<string, string>> | null = null;

function loadCategoryNames(): Promise<Map<string, string>> {
  if (!categoryNameCache) {
    categoryNameCache = apiFetch<{ id: string; name: string }[]>('/api/categories')
      .then((rows) => new Map(rows.map((r) => [r.id, r.name])))
      .catch(() => new Map());
  }
  return categoryNameCache;
}

function loadSubcategoryNames(): Promise<Map<string, string>> {
  if (!subcategoryNameCache) {
    subcategoryNameCache = apiFetch<{ id: string; name: string }[]>('/api/subcategories')
      .then((rows) => new Map(rows.map((r) => [r.id, r.name])))
      .catch(() => new Map());
  }
  return subcategoryNameCache;
}

// AC-3/AC-4/AC-5/AC-8 — front/back flip card with dual-media auto-swap and a favorite toggle.
export function DesignCard({ design: initial }: { design: DesignSummaryDto }) {
  const { user, accessToken } = useAuth();
  const { addItem } = useCart();
  const [design, setDesign] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [backDetail, setBackDetail] = useState<DesignBackDetail | null>(null);
  const [showingEmbroidery, setShowingEmbroidery] = useState(false);
  const [userSelectedMedia, setUserSelectedMedia] = useState(false);
  const [tagName, setTagName] = useState<string | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (design.subcategoryId) {
      loadSubcategoryNames().then((names) => {
        if (!cancelled) setTagName(names.get(design.subcategoryId!) ?? null);
      });
    } else if (design.categoryIds[0]) {
      const firstCategoryId = design.categoryIds[0];
      loadCategoryNames().then((names) => {
        if (!cancelled) setTagName(names.get(firstCategoryId) ?? null);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [design.subcategoryId, design.categoryIds]);

  const hasDualMedia = !!(design.vectorImageUrl || design.vectorVideoUrl) && !!(design.embroideryImageUrl || design.embroideryVideoUrl);

  // Landing Page Experience spec AC-10 — auto-swap is a non-essential motion effect; respect
  // prefers-reduced-motion the same way the header-media carousel does (spec 13 AC-11's own
  // pause-on-interaction posture, but here disabled outright rather than merely pausable).
  useEffect(() => {
    if (!design.autoSwapEnabled || !hasDualMedia || userSelectedMedia) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => setShowingEmbroidery((v) => !v), AUTO_SWAP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [design.autoSwapEnabled, hasDualMedia, userSelectedMedia]);

  async function onFlip() {
    const next = !flipped;
    setFlipped(next);
    if (next && !backDetail) {
      try {
        const detail = await apiFetch<DesignBackDetail>(`/api/designs/${design.id}`);
        setBackDetail(detail);
        if (detail.sizes[0]) setSelectedSizeId(detail.sizes[0].id);
      } catch {
        // back stays in its loading state; the card itself doesn't break
      }
    }
  }

  // AC-1 (Shopping Cart) — sizes aren't known until the back-detail fetch above, so the front
  // button just flips the card (same posture as clicking the card itself) rather than adding
  // blind; the real add-to-cart control lives on the back face where a size can be chosen.
  async function onAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedSizeId) return;
    setAddError(null);
    setAdding(true);
    try {
      await addItem({ designId: design.id, sizeId: selectedSizeId, quantity: 1 });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setAddError(err instanceof ApiClientError ? err.error.message : 'Failed to add to cart.');
    } finally {
      setAdding(false);
    }
  }

  function onSelectMedia(e: React.MouseEvent, embroidery: boolean) {
    e.stopPropagation();
    setUserSelectedMedia(true);
    setShowingEmbroidery(embroidery);
  }

  async function onToggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || !accessToken) return;
    const wasFavorited = design.isFavorited;
    setDesign((d) => ({ ...d, isFavorited: !wasFavorited })); // optimistic
    try {
      await apiFetch(`/api/designs/${design.id}/favorite`, {
        method: wasFavorited ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      setDesign((d) => ({ ...d, isFavorited: wasFavorited })); // rollback (spec §5 Success state)
      if (!(err instanceof ApiClientError)) throw err;
    }
  }

  const mediaImage = showingEmbroidery ? design.embroideryImageUrl : design.vectorImageUrl;
  const frontImage = mediaImage ?? design.previewImageUrl;

  return (
    <div
      onClick={onFlip}
      className="group relative h-72 w-full cursor-pointer [perspective:1000px]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // AC-10 — every mouse/hover interaction must also be keyboard-reachable; Space is the
        // conventional activation key for a role="button" element alongside Enter.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}
      >
        {/* Front (AC-3) */}
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white [backface-visibility:hidden]">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL, no next/image domain config for a catalog whose media host isn't fixed yet */}
          <img src={frontImage} alt={design.name} className="h-40 w-full object-cover" />
          <div className="flex flex-1 flex-col gap-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-brand-navy">{design.name}</p>
              <button onClick={onToggleFavorite} aria-label="Favorite" className={`text-lg ${design.isFavorited ? 'text-red-500' : 'text-gray-300'}`}>
                ♥
              </button>
            </div>
            {tagName && (
              <span className="w-fit rounded-full bg-brand-lightGray px-2 py-0.5 text-[10px] font-medium text-brand-navy">{tagName}</span>
            )}
            {hasDualMedia && (
              <div className="flex gap-1 text-[10px] text-gray-400">
                <button onClick={(e) => onSelectMedia(e, false)} className={showingEmbroidery ? '' : 'font-semibold text-brand-navy'}>
                  Vector
                </button>
                ·
                <button onClick={(e) => onSelectMedia(e, true)} className={showingEmbroidery ? 'font-semibold text-brand-navy' : ''}>
                  Embroidery
                </button>
              </div>
            )}
            <div className="mt-auto flex items-center justify-between">
              <p className="text-sm">
                {design.salePricePkr ? (
                  <>
                    <span className="font-semibold text-brand-navy">Rs {design.salePricePkr}</span>{' '}
                    <span className="text-xs text-gray-400 line-through">Rs {design.pricePkr}</span>
                  </>
                ) : (
                  <span className="font-semibold text-brand-navy">Rs {design.pricePkr}</span>
                )}
              </p>
              {/* Sizes aren't known until the back-detail fetch — this flips to the back face,
                  where a size is chosen and the real "Add to Cart" lives. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!flipped) onFlip();
                }}
                className="rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold text-brand-navy"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        {/* Back (AC-4) */}
        <div
          className="absolute inset-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 [backface-visibility:hidden]"
          style={{ transform: 'rotateY(180deg)' }}
        >
          {!backDetail ? (
            <p className="text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-brand-navy">{design.name}</p>
              {backDetail.description && <p>{backDetail.description}</p>}
              <div>
                <p className="font-medium">Sizes</p>
                <ul className="list-inside list-disc">
                  {backDetail.sizes.map((s) => (
                    <li key={s.id}>
                      {s.label}: {s.widthMm}×{s.heightMm}mm
                    </li>
                  ))}
                </ul>
              </div>
              {backDetail.stitchCount !== null && <p>Stitch count: {backDetail.stitchCount}</p>}
              {backDetail.threadColorCount !== null && <p>Thread colors: {backDetail.threadColorCount}</p>}
              {backDetail.threadColorChanges !== null && <p>Thread color changes: {backDetail.threadColorChanges}</p>}
              {design.tags.length > 0 && <p className="text-gray-400">Tags: {design.tags.join(', ')}</p>}

              {backDetail.sizes.length > 0 && (
                <select
                  value={selectedSizeId}
                  onChange={(e) => setSelectedSizeId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  {backDetail.sizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              {addError && <p className="text-red-600">{addError}</p>}

              <div className="flex items-center justify-between pt-2">
                <Link href={`/designs/${design.id}`} onClick={(e) => e.stopPropagation()} className="text-brand-navy underline">
                  View details
                </Link>
                <button
                  onClick={onAddToCart}
                  disabled={adding || !selectedSizeId}
                  className="rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold text-brand-navy disabled:opacity-50"
                >
                  {added ? 'Added ✓' : adding ? 'Adding…' : 'Add to Cart'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
