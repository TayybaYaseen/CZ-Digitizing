// docs/specs/2026-08-28-14-customer-account-history.md §3 (aspect A-019), AC-2. Aggregates across
// every order_item a customer has ever had, de-duplicated per design/bundle — a design bought
// twice in two separate orders is one row here with two entries in `purchases`, not two rows.
//
// Deliberately does not carry a downloadUrl/fileId of its own: the actual authorized-file listing
// and download action are owned by the Private File Management spec's existing
// `GET /api/orders/:orderId/files` (aspect A-007) — this DTO's `purchases[].orderId` is enough for
// the frontend to call that endpoint per order, and duplicating its authorization logic here would
// be exactly the "new business logic" this spec explicitly disclaims owning (§3).
export interface PurchasedDesignDto {
  type: 'design' | 'bundle';
  id: string;
  name: string;
  previewImageUrl: string | null;
  purchases: { orderId: string; purchasedAt: string }[];
}
