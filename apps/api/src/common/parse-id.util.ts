import { ApiException } from './exceptions/api-exception';

// A URL parameter that is not a whole number ("undefined", "1e3", "1; DROP…", "") can never name a real
// row, so it is a plain 404 — never a `SyntaxError: Cannot convert … to a BigInt` surfacing as a 500.
export function parseIdOr404(value: string, what: string): bigint {
  if (!/^\d{1,18}$/.test(value)) throw new ApiException('RESOURCE_NOT_FOUND', 404, `${what} not found`);
  return BigInt(value);
}
