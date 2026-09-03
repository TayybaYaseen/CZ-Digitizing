'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013) — Payments has no separate
// data model of its own beyond Order/PaymentReceipt (already surfaced on /orders and
// /orders/:id's receipt-review card) and PaymentMethodSetting (already editable on
// /settings/platform, AC-9). Rather than duplicate either UI here, this is a real navigational
// hub between them instead of the previous ComingSoon placeholder.
export default function PaymentsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">Payment method configuration and order-level payment review.</p>
      </div>

      <Card title="Bank-transfer receipts awaiting review">
        <p className="text-sm text-gray-500">
          Review uploaded receipts and confirm or reject payment from each order&apos;s detail page.
        </p>
        <Link href="/orders?status=payment_pending" className="mt-2 inline-block text-sm font-semibold text-navy-800 underline">
          View orders awaiting payment
        </Link>
      </Card>

      <Card title="Payment method settings">
        <p className="text-sm text-gray-500">PayPal, Stripe, and bank-transfer display details (AC-9 — changes apply with no deploy).</p>
        <Link href="/settings/platform" className="mt-2 inline-block text-sm font-semibold text-navy-800 underline">
          Go to Settings
        </Link>
      </Card>
    </div>
  );
}
