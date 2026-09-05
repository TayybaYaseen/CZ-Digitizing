// AC-3/AC-4/AC-5 — pure date-window resolution, unit-tested in isolation from Prisma. If more than
// one advertisement is simultaneously active, the most recently created one wins (no tie-break
// rule specified — spec §8 risk #3 raises the analogous header-media question; this picks the
// same "newest wins" default, flagged as an open risk rather than silently arbitrary).
export interface ActiveAdCandidate {
  id: bigint | string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export function resolveActiveAdvertisement<T extends ActiveAdCandidate>(now: Date, ads: T[]): T | null {
  const active = ads.filter((ad) => ad.isActive && ad.startDate <= now && ad.endDate >= now);
  if (active.length === 0) return null;
  return active.reduce((newest, ad) => (ad.createdAt > newest.createdAt ? ad : newest));
}
