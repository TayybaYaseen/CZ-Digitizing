import { checkMagicBytes } from './magic-bytes';

describe('checkMagicBytes (spec §8 risk #1 — partial, honest signature table)', () => {
  it('validates a PES file whose header starts with #PES', () => {
    const buf = Buffer.concat([Buffer.from('#PES0060'), Buffer.alloc(100)]);
    expect(checkMagicBytes('PES', buf)).toBe(true);
  });

  it('rejects a file with a .pes extension whose content does not start with #PES', () => {
    const buf = Buffer.alloc(100);
    expect(checkMagicBytes('PES', buf)).toBe(false);
  });

  it('validates a DST file whose header starts with LA:', () => {
    const buf = Buffer.concat([Buffer.from('LA:Rose'), Buffer.alloc(500)]);
    expect(checkMagicBytes('DST', buf)).toBe(true);
  });

  it('returns null (not false) for a format with no known signature, so callers never claim validation', () => {
    expect(checkMagicBytes('JEF', Buffer.alloc(10))).toBeNull();
    expect(checkMagicBytes('EXP', Buffer.alloc(10))).toBeNull();
    expect(checkMagicBytes('VP3', Buffer.alloc(10))).toBeNull();
    expect(checkMagicBytes('EMB', Buffer.alloc(10))).toBeNull();
  });
});
