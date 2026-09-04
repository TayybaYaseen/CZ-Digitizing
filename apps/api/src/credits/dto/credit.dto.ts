import type { CreditPackage, CreditTransaction, CreditTransactionType } from '../../generated/prisma';

export interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  pricePkr: number;
  isPublished: boolean;
}

export interface CreditBalanceDto {
  available: number;
  used: number;
  total: number;
}

export interface CreditTransactionDto {
  id: string;
  type: CreditTransactionType;
  amount: number;
  relatedOrderId: string | null;
  note: string | null;
  createdAt: string;
}

export function toCreditPackageDto(pkg: CreditPackage): CreditPackageDto {
  return {
    id: pkg.id.toString(),
    name: pkg.name,
    credits: pkg.credits,
    bonusCredits: pkg.bonusCredits,
    pricePkr: Number(pkg.pricePkr),
    isPublished: pkg.isPublished,
  };
}

export function toCreditTransactionDto(tx: CreditTransaction): CreditTransactionDto {
  return {
    id: tx.id.toString(),
    type: tx.type,
    amount: tx.amount,
    relatedOrderId: tx.relatedOrderId?.toString() ?? null,
    note: tx.note,
    createdAt: tx.createdAt.toISOString(),
  };
}
