import { randomInt } from 'crypto';

// AC-3 — "unique auto-generated reference number" shown to the customer at checkout and matched
// by Admin against the received transfer. Human-typeable/readable (uppercase alnum, dash-grouped)
// since Admin cross-references it manually against a bank statement line — not a UUID.
export function generateBankTransferReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids manual-entry ambiguity
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += alphabet[randomInt(alphabet.length)];
  return `CZD-${suffix.slice(0, 4)}-${suffix.slice(4)}`;
}
