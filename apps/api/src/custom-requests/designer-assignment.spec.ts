import { pickLeastLoadedDesigner } from './designer-assignment.util';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-9.
describe('pickLeastLoadedDesigner', () => {
  it('returns null when there are no candidates', () => {
    expect(pickLeastLoadedDesigner([])).toBeNull();
  });

  it('picks the sole candidate', () => {
    expect(pickLeastLoadedDesigner([{ designerId: '1', activeRequestCount: 5 }])).toBe('1');
  });

  it('picks the candidate with the fewest active requests', () => {
    const result = pickLeastLoadedDesigner([
      { designerId: '1', activeRequestCount: 4 },
      { designerId: '2', activeRequestCount: 1 },
      { designerId: '3', activeRequestCount: 7 },
    ]);
    expect(result).toBe('2');
  });

  it('breaks ties by lowest designer id', () => {
    const result = pickLeastLoadedDesigner([
      { designerId: '5', activeRequestCount: 2 },
      { designerId: '2', activeRequestCount: 2 },
      { designerId: '9', activeRequestCount: 2 },
    ]);
    expect(result).toBe('2');
  });

  it('handles large bigint-range ids correctly (not naive string comparison)', () => {
    const result = pickLeastLoadedDesigner([
      { designerId: '10', activeRequestCount: 2 },
      { designerId: '9', activeRequestCount: 2 },
    ]);
    expect(result).toBe('9');
  });
});
