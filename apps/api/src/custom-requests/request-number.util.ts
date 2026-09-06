import { randomInt } from 'crypto';

// AC-1/AC-7 — architecture DDL's request_number VARCHAR(20) UNIQUE, human-readable like
// OrdersModule's bank-transfer reference (same no-0/O/1/I alphabet, avoids manual-entry ambiguity).
export function generateCustomRequestNumber(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += alphabet[randomInt(alphabet.length)];
  return `CR-${suffix.slice(0, 4)}-${suffix.slice(4)}`;
}
