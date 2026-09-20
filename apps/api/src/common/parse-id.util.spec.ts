import { parseIdOr404 } from './parse-id.util';

describe('parseIdOr404', () => {
  it('parses a whole-number id', () => {
    expect(parseIdOr404('42', 'Order')).toBe(42n);
    expect(parseIdOr404('0', 'Order')).toBe(0n);
  });

  it.each(['undefined', 'null', '', ' 1', '1 ', '1.5', '1e3', '-1', '0x10', 'abc', '1; DROP TABLE orders', '9'.repeat(30)])(
    'turns %p into a 404 RESOURCE_NOT_FOUND instead of a BigInt SyntaxError (a 500)',
    (bad) => {
      expect(() => parseIdOr404(bad, 'Order')).toThrow(expect.objectContaining({ code: 'RESOURCE_NOT_FOUND', status: 404 }));
    },
  );
});
