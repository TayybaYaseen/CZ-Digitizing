'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { inputClass } from './FormField';

interface DesignOption {
  id: string;
  name: string;
}

// Shared by the Home Sections ("related designs") and Advertisements ("target specific designs")
// admin forms — no design multi-select picker existed anywhere in the repo before this. Backed by
// the existing GET /api/designs/search endpoint (debounced), no new backend route.
export function DesignPickerField({
  selected,
  onChange,
  accessToken,
}: {
  selected: DesignOption[];
  onChange: (next: DesignOption[]) => void;
  accessToken: string | null;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DesignOption[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<DesignOption[]>(`/api/designs/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, accessToken]);

  function add(option: DesignOption) {
    if (selected.some((s) => s.id === option.id)) return;
    onChange([...selected, option]);
    setQuery('');
    setResults([]);
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-gold-50 px-2.5 py-1 text-xs text-gold-700">
              {s.name}
              <button type="button" onClick={() => remove(s.id)} className="font-bold">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search designs to add…" className={inputClass} />
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-field border border-gray-200 bg-white">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => add(r)}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
