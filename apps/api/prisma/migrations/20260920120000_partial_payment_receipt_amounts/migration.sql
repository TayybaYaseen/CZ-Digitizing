-- A-013 FINAL PAYMENT ACCESS POLICY: customer files unlock only after 100% of the order amount has
-- been paid AND an authorized admin has confirmed it. To enforce that in the backend an approved
-- receipt must say HOW MUCH money it confirmed, so a partial transfer can be recorded without ever
-- completing the order.
--
--   payment_receipts.confirmed_amount_pkr — the PKR the admin confirmed as received for this receipt
--   (NULL while pending/rejected). The order is paid only when its credits plus the sum of its
--   confirmed receipts reach total_pkr.
--
-- Backfill: before this change approving a receipt always meant "the whole amount due arrived", so
-- every already-confirmed receipt is stamped with its order's amount due (total_pkr - credits_used).
-- Reversible: yes (drop the column). Downtime: none (nullable column add).

ALTER TABLE "payment_receipts" ADD COLUMN "confirmed_amount_pkr" DECIMAL(10,2);

UPDATE "payment_receipts" r
SET "confirmed_amount_pkr" = GREATEST(o."total_pkr" - o."credits_used", 0)
FROM "orders" o
WHERE o."id" = r."order_id" AND r."review_status" = 'confirmed';
