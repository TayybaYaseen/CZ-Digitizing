// docs/specs/2026-08-28-12-custom-design-requests.md AC-9 — "dedicated production tooling ...
// beyond simple status-field updates" starts with not making Admin hand-pick a designer for every
// incoming request. Pure workload-balancing pick: among eligible designers, the one currently
// carrying the fewest non-terminal custom requests; ties broken by lowest user id for determinism
// (stable, testable — no hidden randomness).
export interface DesignerWorkload {
  designerId: string;
  activeRequestCount: number;
}

export function pickLeastLoadedDesigner(candidates: DesignerWorkload[]): string | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, candidate) => {
    if (candidate.activeRequestCount < best.activeRequestCount) return candidate;
    if (candidate.activeRequestCount === best.activeRequestCount && BigInt(candidate.designerId) < BigInt(best.designerId)) return candidate;
    return best;
  }).designerId;
}
