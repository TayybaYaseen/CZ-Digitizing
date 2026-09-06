-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_locale" TEXT;

-- CreateTable
CREATE TABLE "languages" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "native_name" TEXT NOT NULL,
    "is_rtl" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ui_translations" (
    "id" BIGSERIAL NOT NULL,
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_admin_id" BIGINT,

    CONSTRAINT "ui_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_ui_translations_locale_key" ON "ui_translations"("locale", "key");

-- AddForeignKey
ALTER TABLE "ui_translations" ADD CONSTRAINT "ui_translations_locale_fkey" FOREIGN KEY ("locale") REFERENCES "languages"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- spec §4 backfill requirement: seed the 4 languages this pass ships with real translations for
-- (en default, ar/ur as RTL coverage, es as an LTR non-English sanity check). The remaining 11
-- SRS-named languages are intentionally absent rows per AC-6 — adding one later is just an insert.
INSERT INTO "languages" ("code", "name", "native_name", "is_rtl", "is_enabled", "sort_order") VALUES
  ('en', 'English', 'English', false, true, 0),
  ('ar', 'Arabic', 'العربية', true, true, 1),
  ('ur', 'Urdu', 'اردو', true, true, 2),
  ('es', 'Spanish', 'Español', false, true, 3);

-- spec §4 backfill requirement: seed "en" ui_translations from the initial hardcoded UI chrome
-- strings (AC-1's header/nav, cart, checkout, account, FAQ-system-message scope) before they are
-- removed from apps/web source in favor of t() lookups.
INSERT INTO "ui_translations" ("locale", "key", "value", "updated_at") VALUES
  ('en', 'nav.home', 'Home', CURRENT_TIMESTAMP),
  ('en', 'nav.designs', 'Designs', CURRENT_TIMESTAMP),
  ('en', 'nav.services', 'Services', CURRENT_TIMESTAMP),
  ('en', 'nav.cart', 'Cart', CURRENT_TIMESTAMP),
  ('en', 'nav.account', 'Account', CURRENT_TIMESTAMP),
  ('en', 'nav.login', 'Log In', CURRENT_TIMESTAMP),
  ('en', 'nav.logout', 'Log Out', CURRENT_TIMESTAMP),
  ('en', 'cart.title', 'Your Cart', CURRENT_TIMESTAMP),
  ('en', 'cart.empty', 'Your cart is empty.', CURRENT_TIMESTAMP),
  ('en', 'cart.checkout', 'Checkout', CURRENT_TIMESTAMP),
  ('en', 'checkout.title', 'Checkout', CURRENT_TIMESTAMP),
  ('en', 'checkout.placeOrder', 'Place Order', CURRENT_TIMESTAMP),
  ('en', 'account.title', 'My Account', CURRENT_TIMESTAMP),
  ('en', 'account.orders', 'Orders', CURRENT_TIMESTAMP),
  ('en', 'account.settings', 'Settings', CURRENT_TIMESTAMP),
  ('en', 'faq.title', 'Frequently Asked Questions', CURRENT_TIMESTAMP),
  ('en', 'common.loading', 'Loading…', CURRENT_TIMESTAMP),
  ('en', 'common.error', 'Something went wrong.', CURRENT_TIMESTAMP),
  ('en', 'common.save', 'Save', CURRENT_TIMESTAMP),
  ('en', 'common.cancel', 'Cancel', CURRENT_TIMESTAMP);
