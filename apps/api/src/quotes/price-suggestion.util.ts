import type { ServiceMainType } from '../generated/prisma';

// AC-8 — "AI/rule-based suggested quoted_price_pkr". No AI/ML integration exists anywhere in this
// codebase (documented stub posture, same as Home Promotions CMS's A/B-testing/personalization
// stubs), so this ships as a plain, transparent, unit-tested rule: a per-service-type base rate,
// scaled by quantity, plus a rush surcharge for a near-term deadline. Admin always sees this as a
// starting suggestion to accept or override before responding — never sent to the customer as-is.
const BASE_RATE_PKR: Record<ServiceMainType, number> = {
  embroidery_digitizing: 1500,
  vector_art: 1200,
};

const RUSH_WINDOW_DAYS = 3;
const RUSH_SURCHARGE_MULTIPLIER = 1.2;

export function suggestQuotePricePkr(input: { serviceType: ServiceMainType; quantity?: number | null; deadline?: Date | null; now?: Date }): number {
  const now = input.now ?? new Date();
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
  let price = BASE_RATE_PKR[input.serviceType] * quantity;

  if (input.deadline) {
    const daysUntilDeadline = (input.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDeadline >= 0 && daysUntilDeadline <= RUSH_WINDOW_DAYS) {
      price *= RUSH_SURCHARGE_MULTIPLIER;
    }
  }

  return Math.round(price);
}
