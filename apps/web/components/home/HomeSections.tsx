'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HomeSectionDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { DesignCard } from '@/components/DesignCard';

const VISIBLE_CAP = 6; // spec 13 AC-1 — cap at 6, View More once more than 6 exist (shared rule with the Catalog spec)

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-1/AC-2/AC-7 — Admin-curated design showcase
// sections, each independently capped/expanded. Omits itself entirely with zero published sections
// (spec 13 §5 "Empty" state) — the rest of the home page still renders (AC-8).
export function HomeSections() {
  const [sections, setSections] = useState<HomeSectionDto[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiFetch<HomeSectionDto[]>('/api/home/sections').then(setSections).catch(() => setSections([]));
  }, []);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-10">
      {sections.map((section) => {
        const isExpanded = expanded[section.id];
        const visible = isExpanded ? section.designs : section.designs.slice(0, VISIBLE_CAP);
        return (
          <section key={section.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-navy">{section.heading}</h2>
                {section.description && <p className="mt-1 text-sm text-gray-600">{section.description}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((design) => (
                <DesignCard key={design.id} design={design} />
              ))}
            </div>
            {!isExpanded && section.designs.length > VISIBLE_CAP && (
              <div className="text-center">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [section.id]: true }))}
                  className="rounded-md border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5"
                >
                  View More
                </button>
              </div>
            )}
          </section>
        );
      })}
      <div className="text-center">
        <Link href="/designs" className="text-sm font-semibold text-brand-navy underline">
          Browse the full catalog
        </Link>
      </div>
    </div>
  );
}
