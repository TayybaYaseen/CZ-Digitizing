-- Guest checkout: a visitor can buy and pay (bank transfer) without registering or signing in.
--
--   users.is_guest — a customer identity created by guest checkout for the email entered there (no
--   password). Cleared on the first sign-in, which always requires proving ownership of the email.
--
--   orders.guest_access_key_hash — SHA-256 (hex) of the random key in the guest's httpOnly
--   czd_guest_orders cookie; the only thing that authorizes /api/guest-orders. NULL for every order
--   placed while signed in. Indexed: the guest's home-page order list looks orders up by it.
--
--   orders.guest_contact_name / guest_contact_whatsapp — what the guest typed at checkout, so Admin
--   can contact them without the checkout ever touching an existing account's profile.
--
-- Additive only: new nullable columns plus a NOT NULL boolean with a DEFAULT, so every existing row
-- is valid as-is (existing users are not guests, existing orders have no guest key). No backfill.
-- Reversible: yes (drop the columns and the index). Downtime: none.

ALTER TABLE "users" ADD COLUMN "is_guest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "orders"
  ADD COLUMN "guest_access_key_hash" TEXT,
  ADD COLUMN "guest_contact_name" TEXT,
  ADD COLUMN "guest_contact_whatsapp" TEXT;

CREATE INDEX "idx_orders_guest_access_key_hash" ON "orders"("guest_access_key_hash");
