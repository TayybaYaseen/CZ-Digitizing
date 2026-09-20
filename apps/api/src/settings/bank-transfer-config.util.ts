// AC-9 (orders spec) — the bank account customers transfer PKR into, edited by Admin in Settings and
// read live by every checkout / payment page (never hardcoded in a frontend). Only these keys are ever
// stored or returned; anything else in a submitted config is dropped.
export const BANK_TRANSFER_FIELDS = ['bankName', 'accountTitle', 'accountNumber', 'iban', 'instructions'] as const;
export type BankTransferField = (typeof BANK_TRANSFER_FIELDS)[number];
export type BankTransferConfig = Partial<Record<BankTransferField, string>>;

const MAX_LENGTH: Record<BankTransferField, number> = { bankName: 120, accountTitle: 120, accountNumber: 64, iban: 64, instructions: 1000 };

// Trims every known field, drops empty ones and unknown keys, and caps lengths. Returns null when
// nothing usable remains.
export function sanitizeBankTransferConfig(input: unknown): BankTransferConfig | null {
  if (!input || typeof input !== 'object') return null;
  const source = input as Record<string, unknown>;
  const out: BankTransferConfig = {};
  for (const key of BANK_TRANSFER_FIELDS) {
    const value = source[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, MAX_LENGTH[key]);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : null;
}
